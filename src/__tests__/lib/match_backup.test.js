import test from 'node:test'
import assert from 'node:assert/strict'
import { buildMatchBackup, validateMatchBackup, MATCH_BACKUP_SCHEMA } from '#lib/matchBackup.js'

/**
 * Sao lưu / khôi phục lịch sử trận.
 *
 * Luật cứng được khoá ở đây: TẤT CẢ HOẶC KHÔNG GÌ CẢ. Trận đấu là gốc sinh ra Elo và điểm mùa
 * của cả CLB — nhập được một nửa rồi mới phát hiện sai thì phải replay toàn bộ và không có
 * đường lùi. Mọi nhánh dưới đây phải trả `ok: false` chứ không được "nhập phần chạy được".
 */

const okDb = () => ({
  club: { name: 'CLB Test', code: 'TEST' },
  levels: ['Newbie', 'TBY', 'TB-', 'TB'],
  members: [
    { id: 'm1', name: 'A', level: 'tb', gender: 'nam', active: true },
    { id: 'm2', name: 'B', level: 'tb', gender: 'nam', active: true },
    { id: 'm3', name: 'C', level: 'tb', gender: 'nu', active: true },
    { id: 'm4', name: 'D', level: 'tb', gender: 'nu', active: true },
  ],
  guests: [{ id: 'g1', name: 'Khách', level: 'kha', gender: 'nam' }],
  sessions: [{ id: 's1', date: '2026-08-01' }],
  matches: [],
})

const srcDb = () => ({
  ...okDb(),
  matches: [
    {
      id: 'mt1', sessionId: 's1', courtIdx: 0, minutes: 20, at: 1000,
      sets: [[21, 15]], winnerTeam: 'A', ratingEnabled: true,
      initialRatingA: 500, initialRatingB: 480, eloDelta: 12,
      playerKeys: ['m1', 'm2', 'm3', 'm4'],
    },
    {
      id: 'mt2', sessionId: 's1', courtIdx: 0, minutes: 18, at: 2000,
      sets: [[15, 21]], winnerTeam: 'B', ratingEnabled: false,
      playerKeys: ['m1', 'g1', 'm3', 'm4'],
    },
  ],
})

test('Sao lưu lịch sử trận', async (t) => {
  await t.test('1. Xuất rồi nhập lại vào CLB rỗng phải ra đúng dữ liệu cũ', () => {
    const backup = buildMatchBackup(srcDb())
    assert.equal(backup.schema, MATCH_BACKUP_SCHEMA)
    assert.equal(backup.matchCount, 2)

    const res = validateMatchBackup(JSON.parse(JSON.stringify(backup)), okDb())
    assert.equal(res.ok, true, res.error)
    assert.equal(res.matches.length, 2)
    assert.deepEqual(res.matches[0].playerKeys, ['m1', 'm2', 'm3', 'm4'])
    assert.deepEqual(res.matches[0].teamA, ['m1', 'm2'], 'Hai ô đầu là một bên lưới — sai thứ tự là lật ngược kết quả trận')
    assert.deepEqual(res.matches[0].teamB, ['m3', 'm4'])
    assert.equal(res.matches[0].initialRatingA, 500, 'Giữ ảnh Elo lúc đánh, nếu không thì replay ra bảng xếp hạng khác')
    assert.equal(res.matches[1].ratingEnabled, false, 'Trận giao lưu phải giữ nguyên cờ, không thì nó nhảy vào tính Elo')
    assert.equal(res.stats.rated, 1)
    assert.equal(res.stats.casual, 1)
  })

  await t.test('2. Trận thiếu at/initialRating vẫn xuất được, không dựng số giả', () => {
    const db = srcDb()
    db.matches = [{ id: 'mt9', sessionId: 's1', playerKeys: ['m1', 'm2', 'm3', 'm4'], sets: [], winnerTeam: null }]
    const backup = buildMatchBackup(db)
    assert.equal(backup.matches[0].at, null, 'Bịa mốc thời gian là replay Elo ra thứ tự khác')
    assert.equal(backup.matches[0].initialRatingA, null)
  })

  await t.test('3. CLB đã có trận thì CHẶN, không gộp, không thay', () => {
    const backup = buildMatchBackup(srcDb())
    const target = okDb()
    target.matches = [{ id: 'x', sessionId: 's1', playerKeys: ['m1', 'm2', 'm3', 'm4'] }]

    const res = validateMatchBackup(backup, target)
    assert.equal(res.ok, false)
    assert.equal(res.error, 'matchIo.errNotEmpty')
    assert.equal(res.params.n, 1, 'Phải nói rõ đang có bao nhiêu trận để người dùng biết mình sắp đụng vào cái gì')
    assert.equal(res.matches, undefined, 'Từ chối thì không được trả về dữ liệu để ghi')
  })

  await t.test('4. File của thứ khác thì từ chối, không đoán', () => {
    assert.equal(validateMatchBackup(null, okDb()).error, 'matchIo.errSchema')
    assert.equal(validateMatchBackup({}, okDb()).error, 'matchIo.errSchema')
    assert.equal(
      validateMatchBackup({ schema: 'badminclub_settings', matches: [] }, okDb()).error,
      'matchIo.errSchema',
      'File cài đặt cũng là JSON hợp lệ — nhận nhầm là ghi đè nhầm bảng'
    )
  })

  await t.test('5. File từ bản mới hơn thì từ chối, không đọc bừa', () => {
    const backup = buildMatchBackup(srcDb())
    backup.version = 99
    const res = validateMatchBackup(backup, okDb())
    assert.equal(res.ok, false)
    assert.equal(res.error, 'matchIo.errVersion', 'Bản sau có thể thêm cột; đọc bừa là mất dữ liệu im lặng')
  })

  await t.test('6. Trận trỏ sang buổi hoặc người không tồn tại thì chặn cả file', () => {
    const missSession = buildMatchBackup(srcDb())
    missSession.matches[1].sessionId = 's-khong-co'
    const r1 = validateMatchBackup(missSession, okDb())
    assert.equal(r1.error, 'matchIo.errMissingSessions', 'Khoá ngoại session_id NOT NULL — ghi vào là vỡ')
    assert.equal(r1.matches, undefined, 'Chỉ 1 trận hỏng cũng không được nhập 1 trận còn lại')

    const missPlayer = buildMatchBackup(srcDb())
    missPlayer.matches[0].playerKeys = ['m1', 'm2', 'm3', 'nguoi-la']
    const r2 = validateMatchBackup(missPlayer, okDb())
    assert.equal(r2.error, 'matchIo.errMissingPlayers', 'Elo của trận đó không quy được về ai')
  })

  await t.test('7. Trận dị dạng hoặc trùng id thì chặn', () => {
    const bad = buildMatchBackup(srcDb())
    bad.matches.push({ id: '', sessionId: 's1', playerKeys: [] })
    assert.equal(validateMatchBackup(bad, okDb()).error, 'matchIo.errMalformed')

    const dup = buildMatchBackup(srcDb())
    dup.matches[1].id = dup.matches[0].id
    assert.equal(validateMatchBackup(dup, okDb()).error, 'matchIo.errDuplicateId', 'Trùng id là ghi đè lẫn nhau lúc lưu')
  })

  await t.test('8. File rỗng hoặc không có mảng matches thì chặn', () => {
    assert.equal(validateMatchBackup({ schema: MATCH_BACKUP_SCHEMA, version: 1 }, okDb()).error, 'matchIo.errNoMatches')
    assert.equal(validateMatchBackup({ schema: MATCH_BACKUP_SCHEMA, version: 1, matches: [] }, okDb()).error, 'matchIo.errEmptyFile')
  })
})

test('Lọc khoảng thời gian khi xuất', async (t) => {
  const db = () => ({
    club: { name: 'CLB', code: 'T1' },
    levels: ['Y', 'TB'],
    members: [{ id: 'm1', name: 'A', level: 'tb' }, { id: 'm2', name: 'B', level: 'tb' }],
    guests: [],
    sessions: [
      { id: 's1', date: '2026-06-10', courts: [{ from: '18:00', to: '20:00', sold: false }] },
      { id: 's2', date: '2026-08-15', courts: [{ from: '18:00', to: '20:00', sold: false }] },
      { id: 's3', date: '2026-09-20', courts: [{ from: '18:00', to: '20:00', sold: false }] },
    ],
    attendance: { s1: { m1: true }, s2: { m1: true }, s3: { m1: true } },
    sessionGuests: [
      { id: 'sg1', sessionId: 's1', guestId: 'g1', level: 'tb' },
      { id: 'sg3', sessionId: 's3', guestId: 'g1', level: 'tb' },
    ],
    matches: [
      { id: 'a', sessionId: 's1', at: 1, playerKeys: ['m1', 'm2', 'm1', 'm2'] },
      { id: 'b', sessionId: 's2', at: 2, playerKeys: ['m1', 'm2', 'm1', 'm2'] },
      { id: 'c', sessionId: 's3', at: 3, playerKeys: ['m1', 'm2', 'm1', 'm2'] },
    ],
  })

  await t.test('9. Không truyền khoảng thì lấy tất cả', () => {
    const b = buildMatchBackup(db())
    assert.equal(b.matchCount, 3)
    assert.equal(b.range, null, 'range = null đọc đúng là "không lọc gì"')
  })

  await t.test('10. Lọc theo NGÀY BUỔI, bao gồm cả hai đầu', () => {
    const b = buildMatchBackup(db(), { from: '2026-08-01', to: '2026-09-30', label: '2026-Q3' })
    assert.deepEqual(b.matches.map((m) => m.id), ['b', 'c'], 'Trận của buổi ngoài khoảng phải bị loại')
    assert.equal(b.range.label, '2026-Q3', 'Ghi lại đã lọc gì, nếu không mở file ra không biết trong đó là toàn bộ hay một khúc')

    const edge = buildMatchBackup(db(), { from: '2026-08-15', to: '2026-08-15' })
    assert.deepEqual(edge.matches.map((m) => m.id), ['b'], 'Mốc đầu và mốc cuối phải được TÍNH VÀO, lệch 1 ngày là mất cả buổi')
  })

  await t.test('11. Lọc phải cắt luôn buổi, điểm danh và khách kèm theo', () => {
    const b = buildMatchBackup(db(), { from: '2026-08-01', to: '2026-09-30' })
    assert.deepEqual(b.ref.sessions.map((x) => x.id), ['s2', 's3'], 'Giữ lại buổi ngoài khoảng là file phình vô ích')
    assert.deepEqual(Object.keys(b.ref.attendance), ['s2', 's3'])
    assert.deepEqual(b.ref.sessionGuests.map((x) => x.id), ['sg3'], 'Khách của buổi đã bị lọc thì không được còn trong file')
    // Hội viên KHÔNG bị cắt: cần đủ danh sách để seed Elo theo trình độ, và chỉ 22 dòng.
    assert.equal(b.ref.members.length, 2, 'Cắt hội viên là mất seed, replay ra Elo khác')
  })

  await t.test('12. File đã lọc vẫn nhập lại được nguyên vẹn', () => {
    const b = buildMatchBackup(db(), { from: '2026-08-01', to: '2026-09-30' })
    const target = {
      members: db().members, guests: [], sessions: db().sessions, matches: [],
    }
    const res = validateMatchBackup(b, target)
    assert.equal(res.ok, true, res.error)
    assert.equal(res.matches.length, 2)
  })
})
