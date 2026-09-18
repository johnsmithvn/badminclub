import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { TABLES } from '#contexts/dbmap.js'

// ---------------------------------------------------------------------------
// Vì sao có file này
//
// Bug thật: thành viên thường bấm "Nhận kèo" ăn
//   new row violates row-level security policy for table "challenges"
//
// Lớp sync ghi `challenges` bằng UPSERT (`mode: 'id'` -> `INSERT ... ON CONFLICT DO UPDATE`), mà
// Postgres áp CẢ policy INSERT lẫn UPDATE cho câu đó. Migration 0037 nới `challenges_upd` và
// `challenge_players_ins` cho thành viên, nhưng bỏ sót `challenges_ins` — nên nửa đường vẫn bị
// chặn. Sửa ở 0049.
//
// Hành vi RLS chỉ kiểm được trên Postgres thật với nhiều phiên đăng nhập khác nhau, ngoài tầm
// của bộ test thuần này. Nhưng cái SINH RA bug thì kiểm tĩnh được: policy INSERT của một bảng
// ghi-bằng-upsert mà hẹp hơn policy UPDATE của chính nó là bẫy, vì mọi lần sửa dòng đều phải lọt
// qua cả hai. File này gác đúng chỗ đó.
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../../../supabase/migrations')

/** Nội dung mọi migration, ghép theo đúng thứ tự chạy (tên file có số thứ tự ở đầu). */
const allMigrationsInOrder = () => {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
  return files.map((f) => ({ file: f, sql: readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8') }))
}

/**
 * Lấy định nghĩa CUỐI CÙNG của một policy — cái thực sự đang có hiệu lực sau khi chạy hết
 * migration. Đọc bản đầu tiên là sai: `challenges_upd` bị 0037 tạo lại đè lên bản 0022.
 */
const lastPolicyBody = (policyName, table) => {
  let found = null
  for (const { file, sql } of allMigrationsInOrder()) {
    const re = new RegExp(
      `CREATE\\s+POLICY\\s+${policyName}\\s+ON\\s+public\\.${table}\\b([\\s\\S]*?);`,
      'gi',
    )
    let m
    while ((m = re.exec(sql)) !== null) found = { file, body: m[1] }
  }
  return found
}

test('RLS challenges — policy INSERT phải đủ rộng cho đường UPSERT', async (t) => {
  await t.test('1. challenges thật sự được ghi bằng upsert', () => {
    const spec = TABLES.find((x) => x.table === 'challenges')
    assert.ok(spec, 'TABLES phải khai báo bảng challenges')
    assert.ok(
      spec.mode === 'id' || spec.mode === 'key',
      `challenges đang ở mode '${spec.mode}'. Hai mode này ghi bằng upsert nên chạm cả policy INSERT — `
      + 'nếu đổi sang đường khác thì đọc lại toàn bộ lập luận trong file này.',
    )
  })

  await t.test('2. challenges_ins có nhánh cho đấu thủ trong kèo', () => {
    const ins = lastPolicyBody('challenges_ins', 'challenges')
    assert.ok(ins, 'Không tìm thấy CREATE POLICY challenges_ins trong migrations')

    assert.match(
      ins.body,
      /challenge_players/,
      `challenges_ins (định nghĩa cuối ở ${ins?.file}) thiếu nhánh challenge_players. `
      + 'Thiếu nó thì thành viên thường KHÔNG nhận kèo được: upsert phải lọt qua policy INSERT, '
      + 'mà họ không có quyền assign và cũng không phải created_by.',
    )
    // Hai cửa gốc phải còn nguyên, không nới thành ai cũng insert được
    assert.match(ins.body, /has_club_perm/, 'challenges_ins vẫn phải cho admin')
    assert.match(ins.body, /created_by/, 'challenges_ins vẫn phải cho người tự tạo kèo cho mình')
    assert.doesNotMatch(
      ins.body,
      /is_club_member/,
      'challenges_ins CỐ Ý không dùng is_club_member: rộng thế thì thành viên bất kỳ tạo được kèo '
      + 'mới với created_by là người khác, tức mạo danh người khác gạ kèo.',
    )
  })

  await t.test('3. challenges_upd cũng phải cho thành viên — hai policy đi cùng nhau', () => {
    const upd = lastPolicyBody('challenges_upd', 'challenges')
    assert.ok(upd, 'Không tìm thấy CREATE POLICY challenges_upd trong migrations')
    assert.match(
      upd.body,
      /is_club_member|challenge_players/,
      `challenges_upd (định nghĩa cuối ở ${upd?.file}) phải có đường cho thành viên thường. `
      + 'Siết nó lại mà quên là nhận kèo hỏng y như lần trước.',
    )
  })

  await t.test('4. challenge_players_ins phải cho thành viên tự ghi tên vào kèo mở', () => {
    const cpIns = lastPolicyBody('challenge_players_ins', 'challenge_players')
    assert.ok(cpIns, 'Không tìm thấy CREATE POLICY challenge_players_ins')
    assert.match(
      cpIns.body,
      /is_club_member|challenge_players/,
      'Nhận kèo MỞ có thêm người vào teamB, nên bảng challenge_players cũng phải mở cho thành viên.',
    )
  })
})
