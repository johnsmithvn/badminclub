// Client Supabase duy nhất của app.
// Thiếu env thì KHÔNG throw — app vẫn chạy được ở chế độ dữ liệu mẫu (localStorage) để dựng UI,
// và các màn cần đăng nhập sẽ báo rõ là chưa cấu hình DB.

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Đã cấu hình DB chưa. Dùng để quyết định chạy chế độ thật hay chế độ dữ liệu mẫu. */
export const hasSupabase = Boolean(url && anonKey)

if (!hasSupabase && import.meta.env.DEV) {
  console.warn(
    '[supabase] Chưa có VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.\n' +
    'Chạy:  npm run db:start  rồi  npm run db:env > .env.local  và khởi động lại dev server.\n' +
    'Trong lúc đó app chạy bằng dữ liệu mẫu trong localStorage.'
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
