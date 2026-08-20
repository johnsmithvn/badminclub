// Phiên đăng nhập + profile + danh sách CLB của tôi.
// Tách khỏi AppContext (dữ liệu nghiệp vụ của MỘT CLB) vì vòng đời khác nhau:
// phiên sống xuyên suốt, dữ liệu CLB đổi mỗi lần switch club.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { hasSupabase, supabase, unwrap } from '#supabase'
import { t } from '#i18n'

const Ctx = createContext(null)

const ACTIVE_CLUB_KEY = 'badminclub.activeClubId'

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
    /** Đăng ký: email + username + mật khẩu bắt buộc; phone không bắt buộc. */
    async signUp({ email, username, password, name, phone, gender, level }) {
      if (!supabase) throw new Error(t('auth.noDb'))
      const data = unwrap(await supabase.auth.signUp({
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

    /** Kiểm username còn trống — gọi khi blur ô username lúc đăng ký. */
    async usernameAvailable(username) {
      if (!supabase || !username || username.length < 3) return null
      return unwrap(await supabase.rpc('username_available', { p_username: username.trim() }))
    },

    async createClub(form) {
      if (!supabase) throw new Error(t('auth.noDb'))
      const club = unwrap(await supabase.rpc('create_club', {
        p_name: form.name,
        p_opening_balance: parseInt(form.opening || 0, 10) || 0,
        p_opening_date: form.openingDate,
        p_lock_day: parseInt(form.lockDay || 25, 10) || 25,
        p_bank_holder: form.bankHolder || null,
        p_bank_no: form.bankNo || null,
        p_bank_name: form.bankName || null,
      }))
      const list = await refresh(session?.user?.id)
      return { club, list }
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
  }), [refresh, session, setActiveClub])

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
