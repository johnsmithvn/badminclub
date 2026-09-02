// node src/__tests__/sync/fatal.test.js
//
// PHÂN LOẠI LỖI ĐỒNG BỘ (`storage.js: isFatal`). Đây là cái van quyết định hàng đợi ghi có
// thông hay không, và sai cả hai chiều đều đau:
//
//   xếp nhầm CHÍ MẠNG → RETRY : op hỏng nằm lại trong diff MÃI. Mọi thay đổi sau nó không
//       xuống được DB, mà màn hình vẫn báo đã lưu — im lặng, không ai biết mình đang mất dữ
//       liệu. Đúng cái vừa xảy ra trên production khi `club_members` thiếu cột `email`.
//   xếp nhầm RETRY → CHÍ MẠNG : `reload()` đè state, người dùng MẤT thay đổi vừa gõ chỉ vì
//       DB bận một nhịp (deadlock, statement timeout).

import assert from 'node:assert/strict'
import { isFatal } from '#contexts/storage.js'

const err = (code, msg = 'x') => Object.assign(new Error(msg), code ? { code } : {})

/* ---------- không có code = mất mạng, tự khỏi ---------- */

assert.equal(isFatal(new TypeError('Failed to fetch')), false,
  'mất mạng mà coi là chí mạng → reload() đè state, người dùng mất thay đổi chỉ vì rớt wifi một giây')
assert.equal(isFatal(err(null)), false)
assert.equal(isFatal(null), false, 'không được throw khi e rỗng — nó chạy trong catch của flush')
assert.equal(isFatal(undefined), false)

/* ---------- lỗi dữ liệu / lược đồ = chí mạng, phải nạp lại ---------- */

assert.equal(isFatal(err('23503')), true, 'khoá ngoại sai thì thử lại bao lần cũng hỏng — phải nạp lại DB cho hàng đợi thông')
assert.equal(isFatal(err('23505')), true, 'trùng khoá duy nhất')
assert.equal(isFatal(err('42501')), true, 'RLS chặn — quyền sai, chờ không hết')
assert.equal(isFatal(err('42703')), true,
  'thiếu cột: đúng lỗi làm kẹt production khi client ghi club_members.email mà migration 0010 chưa chạy')
assert.equal(isFatal(err('22P02')), true, 'sai kiểu dữ liệu')
assert.equal(isFatal(err('PGRST204')), true, 'schema cache của PostgREST không khớp')

/* ---------- sự cố nhất thời của DB = phải THỬ LẠI ---------- */

;['40001', '40P01', '55P03', '57014', '53300', '08000', '08003', '08006'].forEach((c) => {
  assert.equal(isFatal(err(c)), false,
    c + ' là sự cố nhất thời của DB — coi là chí mạng thì mỗi lần DB bận một nhịp là mất thay đổi vừa gõ')
})
assert.equal(isFatal(err('PGRST301')), false,
  'JWT hết hạn: supabase-js tự làm mới token, lần sau đi được — reload ở đây là mất dữ liệu oan')

console.log('sync fatal classify check: OK')
