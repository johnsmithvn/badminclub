// Client Supabase duy nhất của app.
// Thiếu env thì KHÔNG throw ở tầng module (import lỗi là màn hình trắng, không đọc được gì).
// Thay vào đó `hasSupabase` = false và App.jsx hiện màn hướng dẫn chạy lệnh dựng DB.

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Đã cấu hình DB chưa. false → App.jsx hiện màn hướng dẫn thay vì router. */
export const hasSupabase = Boolean(url && anonKey)

if (!hasSupabase && import.meta.env.DEV) {
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

/** Ném lỗi của Supabase thành Error thường để action bắt và bắn toast. */
export function unwrap({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}
