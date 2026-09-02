// Một store duy nhất cho dữ liệu nghiệp vụ của MỘT CLB.
// db = dữ liệu của CLB đang xem, nạp từ Supabase và đồng bộ ngược qua #contexts/storage.js
// ui = trạng thái màn hình, không lưu ở đâu cả.
// Route KHÔNG nằm ở đây — React Router giữ.

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushNow, load, reset, save, setSyncErrorHandler, setSyncFatalHandler } from '#contexts/storage.js'
import { makeActions } from '#contexts/appActions.js'
import { useAuth } from '#contexts/AuthContext.jsx'
import { t } from '#i18n'
import cfg from '#config/app.json' with { type: 'json' }

const UI0 = {
  tab: { home: 'overview', debts: 'guest', fund: 'month', shuttles: 'buy', settings: 'general', members: 'all', sessions: 'all' },
  dialog: null,
  confirm: null,
  form: {},
  toast: null,
  picked: null,
  expanded: {},
  assignId: null,
  asnMode: 'balance',
}

const Ctx = createContext(null)

export function StoreProvider({ children }) {
  const { activeClubId, activeClub, session } = useAuth()
  const [db, setDb] = useState(null)
  const [ui, setUi] = useState(UI0)
  const [error, setError] = useState(null)

  // "Latest ref": actions cần đọc state mới nhất nhưng không nhận được qua closure.
  // Ghi trong useLayoutEffect (đồng bộ sau commit) chứ KHÔNG ghi trong render — render có thể bị
  // bỏ đi dưới concurrent rendering, ref sẽ trỏ vào state chưa bao giờ commit.
  const dbRef = useRef(db)
  const uiRef = useRef(ui)
  useLayoutEffect(() => { dbRef.current = db }, [db])
  useLayoutEffect(() => { uiRef.current = ui }, [ui])

  // navigate của React Router chỉ lấy được trong component con (App.jsx gán vào đây).
  const navRef = useRef(null)

  const role = activeClub ? activeClub.role : 'owner'
  const userId = session ? session.user.id : null

  /** Nạp lại toàn bộ CLB từ DB. Dùng lúc đổi CLB và sau các RPC ghi phía server. */
  const reload = useCallback(async () => {
    if (!activeClubId) return
    try {
      const fresh = await load(activeClubId)
      setDb((cur) => ({
        ...fresh,
        currentUserId: userId,
        myRole: role,
        viewAs: (cur && cur.clubId === activeClubId && cur.viewAs) || role,
        sessionId: (cur && cur.clubId === activeClubId && cur.sessionId) || null,
      }))
      setError(null)
    } catch (e) {
      console.error('[app] không nạp được dữ liệu CLB', e)
      setError(e)
    }
  }, [activeClubId, role, userId])

  // Đổi CLB (kể cả bỏ chọn) → đẩy nốt thay đổi của CLB cũ (cleanup chạy TRƯỚC body của
  // effect mới), quên ảnh chụp cũ, rồi nạp lại từ đầu.
  useEffect(() => {
    reset()
    if (!activeClubId) {
      setDb(null)
      return undefined
    }
    setDb(null)
    reload()
    return () => { flushNow() }
  }, [activeClubId, reload])

  useEffect(() => { save(db) }, [db])

  const toastTimer = useRef(null)
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const api = useMemo(() => {
    const toast = (msg) => {
      setUi((u) => ({ ...u, toast: msg }))
      clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setUi((u) => ({ ...u, toast: null })), cfg.toastMs)
    }
    setSyncErrorHandler((e) => toast(t('sync.failed', { msg: e.message })))
    // Lỗi không tự khỏi (khoá ngoại, RLS chặn): nạp lại CLB từ DB để hàng đợi thông trở lại.
    // Thay đổi vừa rồi mất — nhưng nó vốn đã không xuống được DB, và giữ lại trên màn hình thì
    // chặn mọi thay đổi sau nó mà không báo gì. Toast nói rõ để người dùng làm lại.
    setSyncFatalHandler((e) => {
      toast(t('sync.fatal', { msg: e.message }))
      reload()
    })
    // makeActions chỉ GIỮ ref trong closure, đọc trong event handler (sau commit), không đọc lúc render.
    return { toast, navRef, a: makeActions({ setDb, setUi, dbRef, uiRef, navRef, toast, reload }) }
  }, [reload])

  const value = useMemo(() => ({ db, ui, error, reload, setDb, setUi, ...api }), [db, ui, error, reload, api])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp() phải nằm trong <StoreProvider>')
  return v
}
