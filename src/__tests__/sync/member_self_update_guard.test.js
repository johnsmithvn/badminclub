import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { TABLES } from '#contexts/dbmap.js'

// ---------------------------------------------------------------------------
// Vì sao có file này
//
// Bug thật: thành viên thường không gắn được danh hiệu lên kệ, và cũng không đổi được châm ngôn.
//
// `club_members` có HAI lớp gác khác vai:
//   * policy `cm_update_self_name` gác DÒNG (chỉ sửa dòng của chính mình)
//   * trigger `guard_member_self_update()` gác CỘT (danh sách trắng cột được tự đổi)
//
// `badge_shelf` và `signature` thêm ở 0027 — SAU khi hàm guard ra đời ở 0010 — nên không có
// trong danh sách trắng, và mọi lượt ghi của thành viên thường bị trigger ném lỗi. Sửa ở 0053.
//
// Đây là cái bẫy sẽ lặp lại: hễ ai thêm một cột trang trí mới vào `club_members` mà quên ghé
// hàm guard, tính năng đó im lặng hỏng với mọi tài khoản không phải chủ CLB — và hỏng theo kiểu
// khó lần, vì giao diện chạy mượt còn lỗi chỉ nổ lúc sync.
//
// Hành vi trigger chỉ kiểm được trên Postgres thật. Nhưng danh sách trắng thì đọc tĩnh được, nên
// file này khoá nó lại: mọi cột client tự ghi cho HỒ SƠ CÁ NHÂN phải có tên trong đó.
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '../../../supabase/migrations')

/** Thân hàm `guard_member_self_update` ở lần định nghĩa CUỐI CÙNG (bản đang có hiệu lực). */
const lastGuardBody = () => {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
  let found = null
  for (const file of files) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    const re = /FUNCTION\s+public\.guard_member_self_update\s*\(\s*\)([\s\S]*?)\$\$;/gi
    let m
    while ((m = re.exec(sql)) !== null) found = { file, body: m[1] }
  }
  return found
}

// Cột trên `club_members` mà chính chủ phải tự sửa được. Đây là dữ liệu trang trí hồ sơ, không
// dính quyền hạn, tiền hay điểm số.
const SELF_EDITABLE = ['name', 'full_name', 'avatar_url', 'badge_shelf', 'signature']

// Cột NHẠY CẢM: đổi được là leo thang quyền hoặc gian lận. Tuyệt đối không được lọt vào danh
// sách trắng, kể cả khi ai đó thêm cho "tiện".
const MUST_STAY_GUARDED = ['role', 'level', 'phone', 'club_id', 'user_id', 'active', 'pending_level']

test('Trigger gác cột club_members', async (t) => {
  await t.test('1. Tìm được định nghĩa hàm guard', () => {
    const guard = lastGuardBody()
    assert.ok(guard, 'Không tìm thấy guard_member_self_update trong migrations')
  })

  await t.test('2. Mọi cột hồ sơ cá nhân đều nằm trong danh sách trắng', () => {
    const guard = lastGuardBody()
    for (const col of SELF_EDITABLE) {
      assert.match(
        guard.body,
        new RegExp(`'${col}'`),
        `Cột '${col}' không có trong danh sách trắng của guard_member_self_update `
        + `(bản cuối ở ${guard.file}). Thiếu nó thì thành viên thường sửa cột này là trigger ném lỗi — `
        + 'đúng cách mà kệ danh hiệu và châm ngôn đã hỏng trước 0053.',
      )
    }
  })

  await t.test('3. Cột nhạy cảm KHÔNG được lọt vào danh sách trắng', () => {
    const guard = lastGuardBody()
    // Chỉ soi phần biểu thức loại trừ, không soi cả câu RAISE EXCEPTION (chữ tiếng Việt trong đó
    // có thể nhắc tới "trình độ", "vai trò" một cách vô hại).
    const exclusionExpr = (guard.body.match(/to_jsonb\(NEW\)[\s\S]*?IS DISTINCT FROM/i) || [''])[0]
    for (const col of MUST_STAY_GUARDED) {
      assert.doesNotMatch(
        exclusionExpr,
        new RegExp(`'${col}'`),
        `Cột nhạy cảm '${col}' bị đưa vào danh sách trắng — thành viên thường tự sửa được là `
        + 'leo thang quyền hoặc gian lận trình độ.',
      )
    }
  })

  await t.test('4. Vẫn chặn tên rỗng', () => {
    const guard = lastGuardBody()
    assert.match(
      guard.body,
      /trim\(NEW\.name\)/,
      'Guard phải giữ luật tên hiển thị không được để trống',
    )
  })
})

// ---------------------------------------------------------------------------
// Lớp thứ hai: RLS.
//
// Trigger ở trên mới là nửa SAU của bài. Nửa TRƯỚC là policy INSERT, và nó chặn sớm hơn:
// `club_members` được ghi bằng upsert (`mode: 'id'` -> `INSERT ... ON CONFLICT DO UPDATE`), mà
// Postgres bắt câu đó lọt qua `WITH CHECK` của policy INSERT trước khi tới policy UPDATE.
//
// `cm_write` (0001) chỉ cho `has_club_perm(club_id, 'members')` — chủ CLB. Thành viên thường sửa
// hồ sơ của chính mình vẫn ăn "new row violates row-level security policy". Sửa ở 0054.
//
// Chẩn đoán nhầm lớp là chuyện đã xảy ra thật: thấy trigger thiếu cột thì tưởng đã xong, nhưng
// lỗi người dùng gặp lại là RLS. Hai assert dưới khoá cả hai lớp để lần sau không lặp lại.
// ---------------------------------------------------------------------------

/** Thân policy ở lần định nghĩa CUỐI CÙNG (bản đang có hiệu lực sau khi chạy hết migration). */
const lastPolicyBody = (policyName, table) => {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
  let found = null
  for (const file of files) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
    const re = new RegExp(
      `CREATE\\s+POLICY\\s+${policyName}\\s+ON\\s+(?:public\\.)?${table}\\b([\\s\\S]*?);`,
      'gi',
    )
    let m
    while ((m = re.exec(sql)) !== null) found = { file, body: m[1] }
  }
  return found
}

test('RLS club_members — policy INSERT phải đủ rộng cho đường UPSERT', async (t) => {
  await t.test('1. club_members thật sự được ghi bằng upsert', () => {
    const spec = TABLES.find((x) => x.table === 'club_members')
    assert.ok(spec, 'TABLES phải khai báo club_members')
    assert.ok(
      spec.mode === 'id' || spec.mode === 'key',
      `club_members đang ở mode '${spec.mode}'. Hai mode này ghi bằng upsert nên chạm cả policy `
      + 'INSERT — đổi sang đường khác thì đọc lại lập luận ở đây.',
    )
  })

  await t.test('2. cm_write có nhánh cho chính chủ sửa hồ sơ mình', () => {
    const ins = lastPolicyBody('cm_write', 'club_members')
    assert.ok(ins, 'Không tìm thấy CREATE POLICY cm_write')
    assert.match(
      ins.body,
      /is_my_member_row/,
      `cm_write (bản cuối ở ${ins?.file}) thiếu nhánh is_my_member_row. Thiếu nó thì thành viên `
      + 'thường không sửa nổi kệ danh hiệu, châm ngôn hay avatar của chính mình — upsert bị chặn '
      + 'ngay ở policy INSERT.',
    )
    assert.match(ins.body, /has_club_perm/, 'cm_write vẫn phải cho người có quyền members kết nạp')
  })

  await t.test('3. Không nới thành ai cũng tự kết nạp được', () => {
    const ins = lastPolicyBody('cm_write', 'club_members')
    assert.doesNotMatch(
      ins.body,
      /user_id\s*=\s*auth\.uid\(\)/,
      'cm_write KHÔNG được dùng `user_id = auth.uid()` trần: thế thì ai cũng INSERT một dòng '
      + 'club_members mới mang user_id của mình vào CLB bất kỳ — tự gia nhập không cần duyệt, và '
      + 'tự chọn luôn role. Phải hỏi qua is_my_member_row (dòng ĐÃ tồn tại và là của mình).',
    )
  })

  await t.test('4. Policy UPDATE cho chính chủ vẫn còn', () => {
    const upd = lastPolicyBody('cm_update_self_name', 'club_members')
    assert.ok(upd, 'Không tìm thấy cm_update_self_name — thiếu nó thì upsert tắc ở bước UPDATE')
    assert.match(upd.body, /user_id\s*=\s*auth\.uid\(\)/, 'Policy UPDATE gác đúng dòng của chính chủ')
  })

  await t.test('5. Helper is_my_member_row phải là SECURITY DEFINER', () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort()
    let body = null
    for (const file of files) {
      const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
      const m = /FUNCTION\s+public\.is_my_member_row\s*\([\s\S]*?\$\$;/i.exec(sql)
      if (m) body = m[0]
    }
    assert.ok(body, 'Không tìm thấy định nghĩa is_my_member_row')
    assert.match(
      body,
      /SECURITY DEFINER/i,
      'Phải là SECURITY DEFINER: nó đọc club_members từ trong policy CỦA club_members, không thì '
      + 'RLS của bảng lại áp lên chính subquery và sinh đệ quy.',
    )
  })
})
