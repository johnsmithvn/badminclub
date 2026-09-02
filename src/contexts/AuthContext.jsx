// Phiên đăng nhập + profile + danh sách CLB của tôi.
// Tách khỏi AppContext (dữ liệu nghiệp vụ của MỘT CLB) vì vòng đời khác nhau:
// phiên sống xuyên suốt, dữ liệu CLB đổi mỗi lần switch club.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { hasSupabase, supabase, unwrap } from '#supabase'
import { intOf } from '#lib/money.js'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

const Ctx = createContext(null)

const ACTIVE_CLUB_KEY = 'badminclub.activeClubId'

/** Lỗi đăng ký của Supabase/Postgres → câu tiếng Việt. Xem chú thích ở signUp. */
function signUpUnwrap({ data, error }) {
  if (!error) return data
  const m = String(error.message || '')
  if (/already registered|already exists|User already/i.test(m)) throw new Error(t('auth.errEmailTaken'))
  if (/Database error saving new user|duplicate key|unique constraint/i.test(m)) {
    throw new Error(t('auth.errUniqueTaken'))
  }
  throw new Error(m)
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [clubs, setClubs] = useState([])
  const [requests, setRequests] = useState([])
  const [activeClubId, setActive] = useState(() => localStorage.getItem(ACTIVE_CLUB_KEY) || null)
  // 'loading' cho tới khi biết chắc có phiên hay không — tránh nháy sang màn login rồi bật lại.
  const [status, setStatus] = useState(hasSupabase ? 'loading' : 'no-db')

  /* ---------- nạp profile + CLB của tôi ---------- */
  const refresh = useCallback(async (uid) => {
    if (!supabase || !uid) {
      setProfile(null)
      setClubs([])
      setRequests([])
      return
    }
    const [p, c, r] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
      supabase.rpc('my_clubs'),
      supabase.rpc('my_join_requests'),
    ])
    setProfile(p.data || null)
    setClubs(c.data || [])
    setRequests(r.data || [])
    return c.data || []
  }, [])

  /* ---------- theo dõi phiên ---------- */
  useEffect(() => {
    if (!supabase) return
    let alive = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return
      setSession(data.session)
      if (data.session) await refresh(data.session.user.id)
      setStatus(data.session ? 'in' : 'out')
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_evt, s) => {
      if (!alive) return
      setSession(s)
      if (s) {
        await refresh(s.user.id)
        setStatus('in')
      } else {
        setProfile(null)
        setClubs([])
        setRequests([])
        setStatus('out')
      }
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [refresh])

  /* ---------- CLB đang xem ---------- */
  const setActiveClub = useCallback((id) => {
    if (id) localStorage.setItem(ACTIVE_CLUB_KEY, id)
    else localStorage.removeItem(ACTIVE_CLUB_KEY)
    setActive(id)
  }, [])

  // CLB đã lưu mà không còn trong danh sách (bị xoá / bị bỏ khỏi CLB) thì coi như chưa chọn.
  // DERIVE chứ không sync bằng effect — giá trị cũ trong localStorage sẽ bị ghi đè lần chọn sau.
  const activeClub = clubs.find((c) => c.id === activeClubId) || null

  const api = useMemo(() => ({
    /**
     * Đăng ký: email + username + mật khẩu bắt buộc; phone không bắt buộc.
     * Trùng email / username / SĐT đều bị chặn ở DB (`profiles` có UNIQUE cả ba cột), nhưng
     * username và SĐT nổ trong trigger `handle_new_user` nên Postgres chỉ trả một câu chung —
     * không nói được cột nào. Dịch ra tiếng Việt ở đây thay vì để user đọc lỗi thô.
     */
    async signUp({ email, username, password, name, phone, gender, level }) {
      if (!supabase) throw new Error(t('auth.noDb'))
      const data = signUpUnwrap(await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: username.trim(),
            name: (name || '').trim() || username.trim(),
            phone: (phone || '').replace(/\s/g, ''),
            gender: gender || '',
            level: level || '',
          },
        },
      }))
      return data
    },

    /** Đăng nhập bằng email HOẶC username HOẶC SĐT. */
    async signIn({ identifier, password }) {
      if (!supabase) throw new Error(t('auth.noDb'))
      const id = identifier.trim()
      // Không phải email thì đổi username/SĐT ra email qua RPC (SECURITY DEFINER, chỉ trả email).
      let email = id
      if (!id.includes('@')) {
        const found = unwrap(await supabase.rpc('resolve_login', { identifier: id }))
        if (!found) throw new Error(t('auth.errNoAccount'))
        email = found
      }
      return unwrap(await supabase.auth.signInWithPassword({ email, password }))
    },

    async signOut() {
      if (!supabase) return
      setActiveClub(null)
      await supabase.auth.signOut()
    },

    /**
     * Sửa hồ sơ TÀI KHOẢN (`profiles`). Chỉ ghi đúng bảng đó.
     *
     * KHÔNG đụng `club_members`: hồ sơ trong mỗi CLB là bản sao độc lập, không phải khung nhìn
     * của hồ sơ tài khoản. Đổi tên ở đây mà lan sang CLB là sửa lại tên trên mọi bảng điểm danh,
     * mọi dòng tiền cũ của người đó — muốn đổi thì xin qua màn Hồ sơ trong CLB (`member_changes`,
     * chủ CLB duyệt).
     *
     * `phone` là cột UNIQUE và cũng là một cách đăng nhập (`resolve_login`), nên trùng số là
     * Postgres trả 23505 với câu tiếng Anh thô — dịch ở đây, đúng khuôn `signUpUnwrap`.
     */
    async updateProfile(patch) {
      if (!supabase) throw new Error(t('auth.noDb'))
      const uid = session && session.user ? session.user.id : null
      if (!uid) throw new Error(t('auth.errNoAccount'))
      const { error } = await supabase.from('profiles').update(patch).eq('id', uid)
      if (error) {
        const m = String(error.message || '')
        if (/duplicate key|unique constraint/i.test(m)) throw new Error(t('auth.errUniqueTaken'))
        throw new Error(m)
      }
      await refresh(uid)
    },

    /** Kiểm username còn trống — gọi khi blur ô username lúc đăng ký. */
    async usernameAvailable(username) {
      if (!supabase || !username || username.length < 3) return null
      return unwrap(await supabase.rpc('username_available', { p_username: username.trim() }))
    },

    async createClub(form) {
      if (!supabase) throw new Error(t('auth.noDb'))
      // intOf chứ KHÔNG parseInt: `parseInt('1.650.000')` ra **1**. Đây là ô nhập tiền cuối cùng
      // trong app còn dùng parseInt trần — 18 ô kia đã dọn ở P4.5, ô này nằm ngoài `appActions`
      // nên bị bỏ sót. Gõ quỹ mang sang có dấu phân cách nghìn là mất tiền im lặng ngay từ lúc
      // tạo CLB, và số dư sai đó theo suốt mọi báo cáo về sau.
      const club = unwrap(await supabase.rpc('create_club', {
        p_name: form.name,
        p_opening_balance: intOf(form.opening),
        p_opening_date: form.openingDate,
        p_lock_day: Math.min(28, Math.max(1, intOf(form.lockDay) || cfg.club.defaultLockDay)),
        p_bank_holder: form.bankHolder || null,
        p_bank_no: form.bankNo || null,
        p_bank_name: form.bankName || null,
      }))
      const list = await refresh(session?.user?.id)
      return { club, list }
    },

    /**
     * Xoá CỨNG một CLB — không hồi được. Hai cổng gác nằm ở RPC `delete_club`
     * (`0007_delete_club.sql`), KHÔNG ở đây: người gọi phải là owner đang hoạt động của chính
     * CLB đó, và `code` phải khớp `clubs.code`. Client chỉ là lớp tiện, không phải lớp bảo vệ —
     * `clubs` cố ý không có policy DELETE nên không có đường xoá nào khác.
     *
     * Bỏ chọn CLB trước khi `refresh()`: `activeClub` là giá trị DERIVE từ `clubs`, nhưng
     * `App.jsx` gác cổng bằng `activeClubId` thô — không xoá id đó thì màn hình vẫn cố nạp một
     * CLB không còn tồn tại và rơi vào trang lỗi.
     *
     * ponytail: nếu đúng lúc bấm xoá còn một thay đổi đang chờ debounce, `flushNow()` của
     * AppContext sẽ ghi vào CLB vừa xoá và bắn một toast "đồng bộ thất bại" thừa. Chưa xử vì
     * phải kéo `storage.reset()` lên tận đây; nâng cấp khi nào thấy nó phiền thật.
     */
    async deleteClub(clubId, code) {
      if (!supabase) throw new Error(t('auth.noDb'))
      unwrap(await supabase.rpc('delete_club', { p_club: clubId, p_code: code }))
      if (activeClubId === clubId) setActiveClub(null)
      return refresh(session?.user?.id)
    },

    async joinByCode(code, note) {
      if (!supabase) throw new Error(t('auth.noDb'))
      const req = unwrap(await supabase.rpc('join_club_by_code', {
        p_code: (code || '').trim().toUpperCase(),
        p_note: note || null,
      }))
      await refresh(session?.user?.id)
      return req
    },

    refreshClubs: () => refresh(session?.user?.id),
  }), [refresh, session, setActiveClub, activeClubId])

  const value = useMemo(
    () => ({
      status, session, profile, clubs, requests,
      activeClub, activeClubId: activeClub ? activeClub.id : null,
      setActiveClub, ...api,
    }),
    [status, session, profile, clubs, requests, activeClub, setActiveClub, api]
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth() phải nằm trong <AuthProvider>')
  return v
}
