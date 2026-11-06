import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '#contexts/AppContext.jsx'
import { gameErr } from '#contexts/gameActions.js'
import { myMember } from '#lib/money.js'
import { gameOf, idleOf, isContiguous, nextSeq, replay, seatedOf } from '#lib/games/registry.js'
import cfg from '#config/app.js'

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

  const reload = useCallback(() => a.gameRoom(roomId)
    .then((d) => { put({ ...d, forId: roomId }); setErr('') })
    .catch((e) => setErr(gameErr(e))), [a, roomId, put])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    const onEvent = (ev) => {
      const d = dataRef.current
      if (ev.type === 'resync' || !d?.room || d.forId !== roomId) { reload(); return }
      if (ev.type === 'move') {
        if (d.moves.some((m) => m.seq === ev.move.seq)) return
        if (ev.move.seq !== nextSeq(d.moves)) { reload(); return }
        put({ ...d, moves: [...d.moves, ev.move] })
      } else if (ev.type === 'room') {
        // Bản tin phòng không kèm ghế: giữ ghế đang có.
        put({ ...d, room: { ...ev.room, players: d.room.players } })
      } else if (ev.type === 'player') {
        const rest = d.room.players.filter((p) => p.memberId !== ev.player.memberId)
        put({ ...d, room: { ...d.room, players: [...rest, ev.player] } })
      }
    }
    const off = a.gameSubscribe(roomId, onEvent)
    // Điện thoại khoá màn hình có thể làm rớt kênh im lặng — mở lại tab là nạp lại cho chắc.
    const onShow = () => { if (!document.hidden) reload() }
    document.addEventListener('visibilitychange', onShow)
    return () => { off(); document.removeEventListener('visibilitychange', onShow) }
  }, [a, roomId, reload, put])

  const room = data?.room || null
  const game = room ? gameOf(room.game) : null
  const seated = useMemo(() => seatedOf(room?.players), [room?.players])
  const mySeat = seated.find((p) => p.memberId === me)?.seat ?? null

  const moves = data?.moves
  const state = useMemo(() => {
    if (!game || !room || room.status === 'waiting') return null
    return replay(game, { options: room.options, seed: room.seed, seats: seated.map((p) => p.seat) }, moves)
  }, [game, room, seated, moves])

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

  /** Đi một nước: hiện ngay trên máy mình, ghi xuống sau. Máy kia đi trước (stale) / lỗi → nạp lại. */
  const play = useCallback(async (move) => {
    const d = dataRef.current
    if (!d || !state || game.validate(state, mySeat, move) != null) return
    if (!isContiguous(d.moves)) { reload(); return }
    const seq = nextSeq(d.moves)
    put({ ...d, moves: [...d.moves, { seq, seat: mySeat, move }] })
    const res = await a.gameMove(d.room.id, seq, move)
    if (res !== 'ok') reload()
  }, [a, game, state, mySeat, reload, put])

  // Nhịp kết nối: người ngồi ghế báo "vẫn ở đây" mỗi games.pingSec giây khi tab đang mở.
  // Tab ẩn (khoá máy) là ngừng báo — quá reconnectGraceSec thì đối thủ được xử thắng.
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

  // Đồng hồ cho "mất kết nối · còn 1:23". Chỉ chạy khi phòng còn mở.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (status !== 'waiting' && status !== 'playing') return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [status])

  const idle = useMemo(() => Object.fromEntries(seated.map((p) => [p.memberId, idleOf(p, now, IDLE)])), [seated, now])

  // Đối thủ quá hạn → tự đòi xử thắng. Server tự đo bằng giờ của nó; từ chối thì thử lại sau claimRetrySec.
  const claimAt = useRef(0)
  useEffect(() => {
    if (status !== 'playing' || !seatedHere || result) return
    const gone = seated.some((p) => p.memberId !== me && idle[p.memberId]?.leftSec <= 0)
    if (!gone || now - claimAt.current < cfg.games.claimRetrySec * 1000) return
    claimAt.current = now
    a.gameClaim(roomId).then((ok) => { if (ok) reload() })
  }, [a, roomId, status, seatedHere, result, seated, me, idle, now, reload])

  return { room, game, state, result, seated, mySeat, me, canMove, idle, moves: data?.moves || [], loading: !data && !err, err, reload, play }
}
