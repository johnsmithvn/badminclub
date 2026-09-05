// Gác cổng + đăng ký route.
//
// Luồng vào:  chưa đăng nhập → /dang-nhap  ·  đã đăng nhập mà chưa chọn CLB → /clb
//             đã chọn CLB → nạp dữ liệu CLB từ Supabase → 13 màn trong AppLayout
// Thiếu .env.local thì app KHÔNG chạy được: mọi dữ liệu nằm ở Supabase, không có chế độ
// dữ liệu mẫu. Xem README mục Chạy.

import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Skeleton } from '#ds'
import AppLayout from '#components/layout/AppLayout.jsx'
import { useApp } from '#contexts/AppContext.jsx'
import { useAuth } from '#contexts/AuthContext.jsx'
import { PAGES, PUBLIC_PATHS, keyOfPath } from '#routes'
import { allowedRoutes } from '#lib/roles.js'
import { hasSupabase } from '#supabase'
import { t } from '#i18n'
import Account from '#pages/Account.jsx'
import Assign from '#pages/Assign.jsx'
import Calendar from '#pages/Calendar.jsx'
import Clubs from '#pages/Clubs.jsx'
import Debts from '#pages/Debts.jsx'
import Fund from '#pages/Fund.jsx'
import Home from '#pages/Home.jsx'
import Leaderboard from '#pages/Leaderboard.jsx'
import Login from '#pages/Login.jsx'
import Members from '#pages/Members.jsx'
import Profile from '#pages/Profile.jsx'
import Register from '#pages/Register.jsx'
import Schedules from '#pages/Schedules.jsx'
import Schema from '#pages/Schema.jsx'
import SessionDetail from '#pages/SessionDetail.jsx'
import Sessions from '#pages/Sessions.jsx'
import Settings from '#pages/Settings.jsx'
import Shuttles from '#pages/Shuttles.jsx'

const SCREEN = {
  home: Home, calendar: Calendar, sessions: Sessions, session: SessionDetail, assign: Assign,
  leaderboard: Leaderboard, schedules: Schedules, members: Members, debts: Debts, fund: Fund,
  shuttles: Shuttles, profile: Profile, settings: Settings, schema: Schema,
}

export default function App() {
  const { status, activeClubId } = useAuth()
  const { pathname } = useLocation()

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
      <Routes>
        {PAGES.map((p) => {
          const C = SCREEN[p.key]
          return <Route key={p.key} path={p.path} element={<C />} />
        })}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  )
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
  pre: {
    font: 'var(--type-mono)', background: 'var(--surface-sunken)', color: 'var(--text-primary)',
    padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)',
    overflowX: 'auto', margin: 0,
  },
}
