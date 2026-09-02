// Client Supabase duy nhất của app.
// Thiếu env thì KHÔNG throw ở tầng module (import lỗi là màn hình trắng, không đọc được gì).
// Thay vào đó `hasSupabase` = false và App.jsx hiện màn hướng dẫn chạy lệnh dựng DB.

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env?.VITE_SUPABASE_URL
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY

/** Đã cấu hình DB chưa. false → App.jsx hiện màn hướng dẫn thay vì router. */
export const hasSupabase = Boolean(url && anonKey)

if (!hasSupabase && import.meta.env?.DEV) {
  console.warn(
    '[supabase] Chưa có VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.\n' +
    'Chạy:  npm run db:start  rồi  npm run db:env > .env.local  và khởi động lại dev server.'
  )
}

export const supabase = hasSupabase
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null

/**
 * Ném lỗi của Supabase thành Error thường để action bắt và bắn toast.
 *
 * GIỮ `code`: Postgres/PostgREST luôn kèm mã ('23503' khoá ngoại, '42501' RLS chặn, 'PGRST…'),
 * còn lỗi mạng thì không có mã nào. `storage.js` dựa đúng vào đó để biết thao tác này thử lại
 * được hay hỏng vĩnh viễn — nuốt mất `code` là mất luôn cách phân biệt.
 */
export function unwrap({ data, error }) {
  if (error) {
    const e = new Error(error.message)
    if (error.code) e.code = error.code
    if (error.details) e.details = error.details
    throw e
  }
  return data
}
