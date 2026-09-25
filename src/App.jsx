// Gác cổng + đăng ký route.
//
// Luồng vào:  chưa đăng nhập → /dang-nhap  ·  đã đăng nhập mà chưa chọn CLB → /clb
//             đã chọn CLB → nạp dữ liệu CLB từ Supabase → 13 màn trong AppLayout
// Thiếu .env.local thì app KHÔNG chạy được: mọi dữ liệu nằm ở Supabase, không có chế độ
// dữ liệu mẫu. Xem README mục Chạy.

import { Component, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Button, Skeleton } from '#ds'
import AppLayout from '#components/layout/AppLayout.jsx'
import { useApp } from '#contexts/AppContext.jsx'
import { useAuth } from '#contexts/AuthContext.jsx'
import { PAGES, PUBLIC_PATHS, keyOfPath } from '#routes'
import { allowedRoutes } from '#lib/roles.js'
import { myMember } from '#lib/money.js'
import { hasSupabase } from '#supabase'
import { t } from '#i18n'
import Account from '#pages/Account.jsx'
import Badges from '#pages/Badges.jsx'
import Calendar from '#pages/Calendar.jsx'
import Clubs from '#pages/Clubs.jsx'
import Debts from '#pages/Debts.jsx'
import Fund from '#pages/Fund.jsx'
import Home from '#pages/Home.jsx'
import MyStats from '#pages/MyStats.jsx'
import Leaderboard from '#pages/Leaderboard.jsx'
import Login from '#pages/Login.jsx'
import Matches from '#pages/Matches.jsx'
import Members from '#pages/Members.jsx'
import Profile from '#pages/Profile.jsx'
import Register from '#pages/Register.jsx'
import Schema from '#pages/Schema.jsx'
import SessionDetail from '#pages/SessionDetail.jsx'
import Sessions from '#pages/Sessions.jsx'
import Settings from '#pages/Settings.jsx'
import TournamentBracket from '#pages/TournamentBracket.jsx'
import TournamentHub from '#pages/TournamentHub.jsx'
import Tournaments from '#pages/Tournaments.jsx'

const SCREEN = {
  home: MyStats, overview: Home, calendar: Calendar, sessions: Sessions, session: SessionDetail,
  matches: Matches, leaderboard: Leaderboard, badges: Badges, members: Members, debts: Debts, fund: Fund,
  profile: Profile, settings: Settings, schema: Schema, tournaments: Tournaments, tournament: TournamentHub,
  tournamentBracket: TournamentBracket,
}

export default function App() {
  const { status, activeClubId, setActiveClub, clubs } = useAuth()
  const { db, a } = useApp()
  const { pathname, search } = useLocation()
  const navigate = useNavigate()

  // Lắng nghe điều hướng từ Service Worker khi người dùng bấm thông báo.
  // CLB không đọc từ message: `sw.js` chỉ gửi { type, url }. CLB nằm trong `?club=` của chính
  // URL đó, và effect bên dưới xử lý — kể cả khi app mở nguội bằng `openWindow`.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMessage = (event) => {
      if (event.data?.type === 'navigate' && event.data.url) {
        navigate(event.data.url)
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [navigate])

  // Xử lý tham số ?club= khi mở app từ deep link Web Push.
  //
  // Chỉ dọn `?club=` SAU khi `clubs` đã nạp xong: lúc mở nguội từ notification, render đầu tiên
  // còn `clubs` rỗng — xoá param ngay lúc đó là vứt mất đích đến trước khi kịp chuyển CLB.
  useEffect(() => {
    if (!search || status !== 'in') return
    const params = new URLSearchParams(search)
    const clubParam = params.get('club')
    if (!clubParam) return
    if (!(clubs || []).length) return

    if (clubParam !== activeClubId && clubs.some((c) => c.id === clubParam)) {
      setActiveClub?.(clubParam)
    }
    // Xong việc thì gỡ param khỏi URL — để lại thì nút Back quay về vòng chuyển CLB, và mọi
    // lần `setSearchParams` của các màn sau đều kéo theo nó.
    // CHỈ gỡ `club`: `n` được effect bên dưới xử lý và phải sống tới lúc thông báo nạp xong.
    params.delete('club')
    const rest = params.toString()
    navigate({ pathname, search: rest ? `?${rest}` : '' }, { replace: true })
  }, [search, pathname, status, activeClubId, clubs, setActiveClub, navigate])

  // Bấm vào thông báo đẩy → đánh dấu dòng đó ĐÃ ĐỌC.
  //
  // Trước đây chỉ `NotificationPanel` mới gọi `markNotificationRead`, nên bấm push thì app
  // nhảy đúng màn nhưng chuông vẫn giữ nguyên số và dòng vẫn đậm như chưa đọc.
  //
  // `n` có dạng `<type>_<refId>` — đúng bằng `tag` của notification (xem `buildPushUrl`).
  // So khớp nguyên chuỗi, không tách, vì `type` tự nó đã chứa dấu gạch dưới.
  useEffect(() => {
    if (!search || status !== 'in') return
    const params = new URLSearchParams(search)
    const mark = params.get('n')
    if (!mark) return
    // Chờ dữ liệu CLB nạp xong mới dò được id dòng thông báo — gỡ `n` sớm là mất dấu.
    if (!db?.notifications) return

    const myId = myMember(db)?.id || null
    const hit = db.notifications.find((x) => (
      x.memberId === myId && !x.readAt && x.refId && `${x.type}_${x.refId}` === mark
    ))
    if (hit) a.markNotificationRead(hit.id)

    params.delete('n')
    const rest = params.toString()
    navigate({ pathname, search: rest ? `?${rest}` : '' }, { replace: true })
  }, [search, pathname, status, db, a, navigate])

  // Chưa biết có phiên hay không thì đừng render gì — tránh nháy sang màn đăng nhập rồi bật lại.
  if (status === 'loading') return <Splash />

  if (!hasSupabase) return <NoDb />

  const onPublic = Object.values(PUBLIC_PATHS).indexOf(pathname) >= 0

  if (status !== 'in') {
    return (
      <Routes>
        <Route path={PUBLIC_PATHS.login} element={<Login />} />
        <Route path={PUBLIC_PATHS.register} element={<Register />} />
        <Route path="*" element={<Navigate to={PUBLIC_PATHS.login} replace />} />
      </Routes>
    )
  }

  // Đã đăng nhập nhưng chưa chọn CLB → chỉ cho vào màn CLB.
  if (!activeClubId && !onPublic) return <Navigate to={PUBLIC_PATHS.clubs} replace />

  return (
    <Routes>
      <Route path={PUBLIC_PATHS.clubs} element={<Clubs />} />
      {/* Hồ sơ TÀI KHOẢN: ngoài CLB, không cần chọn CLB nào trước. Hồ sơ TRONG một CLB là
          route 'profile' (/ca-nhan) nằm trong AppLayout. */}
      <Route path={PUBLIC_PATHS.account} element={<Account />} />
      <Route path={PUBLIC_PATHS.login} element={<Navigate to="/" replace />} />
      <Route path={PUBLIC_PATHS.register} element={<Navigate to="/" replace />} />
      <Route path="*" element={<InClub />} />
    </Routes>
  )
}

/** Phần trong một CLB: layout + 13 màn + gác quyền theo vai. */
function InClub() {
  const { db, error, navRef } = useApp()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const route = keyOfPath(pathname)

  // actions không gọi được hook nên nhận navigate qua ref — xem docs/ARCHITECTURE.md §4.
  useEffect(() => { navRef.current = navigate }, [navigate, navRef])

  if (error) return <Splash text={t('sync.loadFailed', { msg: error.message })} />
  // Chưa nạp xong dữ liệu CLB thì chưa render màn nào — mọi màn đều đọc db ngay dòng đầu.
  if (!db) return <LoadingClub />
  const role = db.viewAs || 'owner'

  // Vai không được vào route này → về Trang chủ, KHÔNG hiện trang lỗi.
  const ok = allowedRoutes(role)
  if (ok && ok.indexOf(route) < 0) return <Navigate to="/" replace />

  return (
    <AppLayout route={route}>
      <ScreenError key={route}>
        <Routes>
          {PAGES.map((p) => {
            const C = SCREEN[p.key]
            return <Route key={p.key} path={p.path} element={<C />} />
          })}
          <Route path="/lich-co-dinh" element={<Navigate to="/cai-dat" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ScreenError>
    </AppLayout>
  )
}

/**
 * Một màn nổ thì chỉ mất màn đó — header và thanh điều hướng vẫn còn để đi chỗ khác.
 *
 * Trước đây app KHÔNG có ranh giới lỗi nào: một lỗi chưa bắt làm React gỡ sạch cây, `#root`
 * rỗng, và thứ hiện ra là màn "Lỗi khởi động ứng dụng" của `index.html` — nói sai hoàn toàn
 * nguyên nhân, vì nó chỉ hiện khi `#root` rỗng chứ không phải chỉ lúc khởi động.
 *
 * Không có nút "thử lại": nơi gọi truyền `key={route}`, đổi màn là React dựng lại component
 * này từ đầu nên state lỗi tự sạch.
 */
class ScreenError extends Component {
  constructor(props) {
    super(props)
    this.state = { err: null }
  }

  static getDerivedStateFromError(err) {
    return { err }
  }

  componentDidCatch(err, info) {
    console.error('[screen] lỗi chưa bắt', err, info?.componentStack)
  }

  render() {
    if (!this.state.err) return this.props.children
    return (
      <div style={S.screenErr}>
        <div style={{ font: 'var(--type-h3)', color: 'var(--text-primary)' }}>{t('screenError.title')}</div>
        <div style={{ color: 'var(--text-muted)' }}>{t('screenError.desc')}</div>
        <pre style={S.pre}>{this.state.err.message}</pre>
        <Button onClick={() => window.location.reload()}>{t('screenError.reload')}</Button>
      </div>
    )
  }
}

function Splash({ text }) {
  return <div style={S.splash}>{text || t('auth.loading')}</div>
}

/** Đang nạp dữ liệu CLB: skeleton mang đúng hình nội dung sắp hiện, không dùng spinner. */
function LoadingClub() {
  return (
    <div style={S.load} aria-busy="true" aria-label={t('sync.loading')}>
      <Skeleton width="200px" height={26} />
      <div style={S.loadStats}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={112} radius={10} />)}
      </div>
      <div style={S.loadPair}>
        {[0, 1].map((i) => <Skeleton key={i} height={230} radius={10} />)}
      </div>
      <Skeleton height={180} radius={10} />
    </div>
  )
}

/** Thiếu .env.local — nói thẳng phải chạy lệnh gì, đừng để người dùng đoán. */
function NoDb() {
  return (
    <div style={S.splash}>
      <div style={{ display: 'grid', gap: 10, maxWidth: 520, textAlign: 'left' }}>
        <div style={{ font: 'var(--type-h3)', color: 'var(--text-primary)' }}>{t('setup.title')}</div>
        <div>{t('setup.desc')}</div>
        <pre style={S.pre}>{t('setup.cmds')}</pre>
        <div>{t('setup.after')}</div>
      </div>
    </div>
  )
}

const S = {
  load: {
    minHeight: '100vh', background: 'var(--surface-page)', padding: '20px 22px',
    display: 'grid', gap: 16, alignContent: 'start',
    maxWidth: 1440, margin: '0 auto', width: '100%', boxSizing: 'border-box',
  },
  loadStats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12 },
  loadPair: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(420px,1fr))', gap: 16 },
  splash: {
    minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24,
    background: 'var(--surface-page)', font: 'var(--type-caption)', color: 'var(--text-muted)',
  },
  screenErr: {
    display: 'grid', gap: 12, justifyItems: 'start', alignContent: 'start',
    padding: '24px 22px', maxWidth: 720, margin: '0 auto', width: '100%', boxSizing: 'border-box',
  },
  pre: {
    font: 'var(--type-mono)', background: 'var(--surface-sunken)', color: 'var(--text-primary)',
    padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)',
    overflowX: 'auto', margin: 0,
  },
}
