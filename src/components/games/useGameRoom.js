import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '#contexts/AppContext.jsx'
import { gameErr } from '#contexts/gameActions.js'
import { myMember } from '#lib/money.js'
import { gameOf, idleOf, inGameOf, isContiguous, nextSeq, replay, seatedOf, waitSinceOf, waitingOf } from '#lib/games/registry.js'
import cfg from '#config/app.js'

const CHAT_MAX = 60 // giữ bấy nhiêu tin gần nhất
const CHAT_LEN = 200 // ký tự mỗi tin
const IDLE = { offlineSec: cfg.games.offlineSec, graceSec: cfg.games.reconnectGraceSec }

/**
 * Một phòng đang mở: nạp phòng + log, nghe realtime, dựng state từ log, đi nước, báo kết quả.
 * Đồng bộ theo docs/GAMES.md §6: mỗi lần (nối lại) kênh hay quay lại tab → nạp lại cả phòng;
 * nhận nước không liền seq → nạp lại.
 */
export function useGameRoom(roomId) {
  const { db, a } = useApp()
  const me = myMember(db)?.id || null
  const [raw, setData] = useState(null) // { forId, room, moves }
  const [err, setErr] = useState('')
  // Ref đi cùng state: sự kiện realtime đến dồn dập phải đọc bản MỚI NHẤT, không chờ render.
  const dataRef = useRef(null)
  const put = useCallback((d) => { dataRef.current = d; setData(d) }, [])
  // Sang phòng khác (Chơi lại) thì bản của phòng cũ coi như chưa nạp — khỏi xoá state trong effect.
  const data = raw?.forId === roomId ? raw : null
  // Chat trong phòng: tin broadcast qua kênh realtime của phòng — chỉ ai đang mở phòng thấy, không lưu, tải lại là mất.
  // ponytail: tên người gửi do máy gửi tự khai (không qua server); cần lịch sử / chống mạo danh thì làm bảng game_chat + RLS.
  const [chatRaw, setChat] = useState({ forId: roomId, list: [] })
  const chat = chatRaw.forId === roomId ? chatRaw.list : []
  const sayRef = useRef(null)
  // Ai đang mở phòng (presence) — ghế + người xem. Kênh đổi phòng thì danh sách cũ bỏ.
  const [hereRaw, setHere] = useState({ forId: roomId, ids: [] })
  const here = hereRaw.forId === roomId ? hereRaw.ids : []
  // Đếm ngược 3-2-1 trước khi chủ phòng bắt đầu ván (bản Phòng chờ v2): giờ máy này nhận tín hiệu.
  const [countRaw, setCount] = useState({ forId: roomId, at: 0 })
  const countAt = countRaw.forId === roomId ? countRaw.at : 0
  const countRef = useRef(null)
  const addChat = useCallback((msg) => setChat((c) => ({ forId: roomId, list: [...(c.forId === roomId ? c.list : []), msg].slice(-CHAT_MAX) })), [roomId])

  const reload = useCallback(() => a.gameRoom(roomId)
    .then((d) => { put({ ...d, forId: roomId }); setErr('') })
    .catch((e) => setErr(gameErr(e))), [a, roomId, put])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    const onEvent = (ev) => {
      const d = dataRef.current
      if (ev.type === 'chat') {
        const m = ev.msg
        if (typeof m?.text === 'string' && typeof m.memberId === 'string' && m.text.trim()) addChat({ memberId: m.memberId, text: m.text.slice(0, CHAT_LEN), at: Date.now() })
        return
      }
      if (ev.type === 'here') { setHere({ forId: roomId, ids: ev.ids || [] }); return }
      if (ev.type === 'count') { setCount({ forId: roomId, at: Date.now() }); return }
      if (ev.type === 'resync' || !d?.room || d.forId !== roomId) { reload(); return }
      if (ev.type === 'move') {
        const i = d.moves.findIndex((m) => m.seq === ev.move.seq)
        // Nước máy mình vừa hiện trước (chưa có giờ server) → thay bằng bản server ghi: cần giờ đó để biết ván bắt
        // đầu chờ đối thủ từ lúc nào (waitSinceOf).
        if (i >= 0) {
          if (!d.moves[i].at) put({ ...d, moves: d.moves.map((m, k) => (k === i ? ev.move : m)) })
          return
        }
        if (ev.move.seq !== nextSeq(d.moves)) { reload(); return }
        put({ ...d, moves: [...d.moves, ev.move] })
      } else if (ev.type === 'room') {
        // Bản tin phòng không kèm ghế: giữ ghế đang có.
        if (d.room.status === 'waiting' && ev.room.status === 'waiting') {
          if (JSON.stringify(d.room.options) !== JSON.stringify(ev.room.options)) addChat({ sys: 'games.wait.sysRules', at: Date.now() })
          if (d.room.hostId !== ev.room.hostId) addChat({ sys: 'games.wait.sysHost', memberId: ev.room.hostId, at: Date.now() })
        }
        put({ ...d, room: { ...ev.room, players: d.room.players } })
      } else if (ev.type === 'player') {
        const old = d.room.players.find((p) => p.memberId === ev.player.memberId)
        const p = ev.player
        // Tin hệ thống trong chat phòng chờ (bản 2): vào / rời / bị mời ra / sẵn sàng. Nhịp game_ping chỉ đổi seen_at → bỏ qua.
        if (d.room.status === 'waiting') {
          const sys = !p.leftAt && (!old || old.leftAt) ? 'games.wait.sysJoin'
            : p.leftAt && old && !old.leftAt ? (p.kicked ? 'games.wait.sysKick' : 'games.wait.sysLeave')
              : !p.leftAt && old && p.ready !== old.ready ? (p.ready ? 'games.wait.sysReady' : 'games.wait.sysUnready') : null
          if (sys) addChat({ sys, memberId: p.memberId, at: Date.now() })
        }
        const rest = d.room.players.filter((x) => x.memberId !== p.memberId)
        put({ ...d, room: { ...d.room, players: [...rest, p] } })
      }
    }
    const off = a.gameSubscribe(roomId, onEvent)
    sayRef.current = off.say || null
    countRef.current = off.count || null
    // Điện thoại khoá màn hình có thể làm rớt kênh im lặng — mở lại tab là nạp lại cho chắc.
    const onShow = () => { if (!document.hidden) reload() }
    document.addEventListener('visibilitychange', onShow)
    return () => { off(); sayRef.current = null; countRef.current = null; document.removeEventListener('visibilitychange', onShow) }
  }, [a, roomId, reload, put, addChat])

  const room = data?.room || null
  const game = room ? gameOf(room.game) : null
  const seated = useMemo(() => seatedOf(room?.players), [room?.players])
  const inGame = useMemo(() => inGameOf(room), [room])
  const mySeat = seated.find((p) => p.memberId === me)?.seat ?? null

  const moves = data?.moves
  const state = useMemo(() => {
    if (!game || !room || room.status === 'waiting') return null
    return replay(game, { options: room.options, seed: room.seed, seats: inGame.map((p) => p.seat) }, moves)
  }, [game, room, inGame, moves])

  const result = room?.result || (state && game.result(state)) || null
  const canMove = !!state && room.status === 'playing' && mySeat != null && !result && state.turn === mySeat

  // Ván vừa xong trên máy này → báo kết quả. Mọi máy đang ngồi đều báo; server chỉ nhận lần đầu.
  const finishedRef = useRef(null)
  useEffect(() => {
    if (!room || room.status !== 'playing' || mySeat == null || !state) return
    const r = game.result(state)
    if (!r || finishedRef.current === room.id) return
    finishedRef.current = room.id
    a.gameFinish(room.id, r)
  }, [a, game, room, mySeat, state])

  /**
   * Đi một nước: hiện ngay trên máy mình, ghi xuống sau. Máy kia đi trước (stale) / lỗi → nạp lại.
   * Nước server phải điền (`game.request` trả true — xúc xắc, kết quả phát bắn, lá vừa bốc; hàm game_<id>_fill)
   * thì máy này chưa biết kết quả: không hiện trước, ghi xong nạp lại lấy bản server đã điền.
   */
  const play = useCallback(async (move) => {
    const d = dataRef.current
    if (!d || !state || game.validate(state, mySeat, move) != null) return
    if (!isContiguous(d.moves)) { reload(); return }
    const seq = nextSeq(d.moves)
    const ask = !!game.request?.(state, mySeat, move)
    if (!ask) put({ ...d, moves: [...d.moves, { seq, seat: mySeat, move }] })
    const res = await a.gameMove(d.room.id, seq, move)
    if (res !== 'ok' || ask) reload()
  }, [a, game, state, mySeat, reload, put])

  // Nhịp kết nối: người ngồi ghế báo "vẫn ở đây" mỗi games.pingSec giây khi tab đang mở.
  // Tab ẩn (khoá máy) là ngừng báo — ván đang chờ mình mà quá reconnectGraceSec thì bị xử (xem `idle` bên dưới).
  const status = room?.status
  const seatedHere = mySeat != null
  useEffect(() => {
    if (!seatedHere || (status !== 'waiting' && status !== 'playing')) return undefined
    const beat = () => { if (!document.hidden) a.gamePing(roomId) }
    beat()
    const timer = setInterval(beat, cfg.games.pingSec * 1000)
    document.addEventListener('visibilitychange', beat)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', beat) }
  }, [a, roomId, seatedHere, status])

  // Giữ màn hình sáng khi đang ngồi chơi: máy tự khoá màn hình là tab ẩn, ngừng nhịp ở trên. Trình duyệt tự nhả khi
  // tab ẩn → hiện lại thì xin lại. Không hỗ trợ / bị từ chối (pin yếu) thì thôi, hạn xử thua vẫn như dưới.
  useEffect(() => {
    if (!seatedHere || status !== 'playing' || !navigator.wakeLock) return undefined
    let lock = null
    let asking = false
    let done = false
    const hold = () => {
      if (done || asking || document.hidden || (lock && !lock.released)) return
      asking = true
      navigator.wakeLock.request('screen')
        .then((l) => { if (done) l.release(); else lock = l })
        .catch(() => {})
        .finally(() => { asking = false })
    }
    hold()
    document.addEventListener('visibilitychange', hold)
    return () => {
      done = true
      document.removeEventListener('visibilitychange', hold)
      lock?.release().catch(() => {})
    }
  }, [seatedHere, status])

  // Đồng hồ cho "mất kết nối · còn 1:23". Chỉ chạy khi phòng còn mở.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (status !== 'waiting' && status !== 'playing') return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [status])

  // Chỉ người ván đang chờ mới bị đếm giờ xử thua, đếm từ lúc ván bắt đầu chờ (docs/GAMES.md §5.1b). Người đang chờ
  // đối thủ nghĩ mà khoá máy chỉ hiện "mất kết nối".
  const waiting = useMemo(() => (status === 'playing' ? waitingOf(game, state) : []), [status, game, state])
  const since = waitSinceOf(room, moves)
  const idle = useMemo(() => Object.fromEntries(seated.map((p) => [
    p.memberId, idleOf(p, now, IDLE, waiting.includes(p.seat) ? since : null),
  ])), [seated, now, waiting, since])

  // Người ván đang chờ quá hạn → tự đòi xử, nêu đúng ghế đó. Server tự đo bằng giờ của nó (0085: chỉ xử ghế được nêu,
  // ván phải đứng yên đủ hạn); từ chối thì thử lại sau claimRetrySec.
  const claimAt = useRef(0)
  useEffect(() => {
    if (status !== 'playing' || !seatedHere || result) return
    const due = (p) => idle[p.memberId]?.leftSec != null && idle[p.memberId].leftSec <= 0
    const seats = seated.filter((p) => p.memberId !== me && due(p)).map((p) => p.seat)
    if (!seats.length || now - claimAt.current < cfg.games.claimRetrySec * 1000) return
    claimAt.current = now
    a.gameClaim(roomId, seats).then((ok) => { if (ok) reload() })
  }, [a, roomId, status, seatedHere, result, seated, me, idle, now, reload])

  const say = useCallback((text) => {
    const msg = { memberId: me, text: text.trim().slice(0, CHAT_LEN) }
    if (!me || !msg.text) return
    sayRef.current?.(msg)
    addChat({ ...msg, at: Date.now() })
  }, [me, addChat])

  /** Chủ phòng: báo mọi máy đếm ngược (máy mình đếm luôn — kênh không gửi lại cho chính mình). */
  const countdown = useCallback(() => { countRef.current?.(); setCount({ forId: roomId, at: Date.now() }) }, [roomId])

  return { room, game, state, result, seated, inGame, mySeat, me, canMove, idle, moves: data?.moves || [], loading: !data && !err, err, reload, play, chat, say, here, countAt, countdown }
}
