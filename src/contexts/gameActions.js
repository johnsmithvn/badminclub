// Hành động của Mini-game — trải vào `a.*` trong makeActions (appActions.js).
//
// Như Thư viện / Giải đấu: dữ liệu KHÔNG nằm trong `db`, KHÔNG qua diff()/save(). Trang tự nạp,
// mỗi lần ghi chờ DB xong mới báo. Luật quyền nằm ở RPC của 0074; luật game ở lib/games/*.

import { findGameRoom, gameRpc, loadGameHand, loadGameLobby, loadGameRoom, subscribeGameRoom } from '#contexts/storage.js'
import { gameOf } from '#lib/games/registry.js'
import { myMember } from '#lib/money.js'
import { t } from '#i18n'

/** Lỗi mang key `games.err.*` (từ RAISE của RPC) → dịch; lỗi khác giữ nguyên để còn biết là gì. */
export const gameErr = (e) => {
  const m = String(e?.message || e || '')
  return m.startsWith('games.err.') ? t(m) : m
}

/**
 * Máy này đang thiếu log (máy kia vừa đi trước) → nạp lại, không báo lỗi. 23505 = trùng PK (room_id, seq).
 * games.err.notYet = báo hết giờ hơi sớm so với đồng hồ server (Nối từ) — máy tự thử lại, không làm phiền người chơi.
 */
const isStale = (e) => e?.code === '23505' || ['games.err.stale', 'games.err.notYet'].includes(String(e?.message || ''))

export function makeGameActions({ dbRef, toast }) {
  const db = () => dbRef.current
  const me = () => myMember(db())?.id || null

  const run = async (fn, ok) => {
    try {
      const res = await fn()
      if (ok) toast(ok(res))
      return res ?? true
    } catch (e) {
      toast(gameErr(e))
      return null
    }
  }

  return {
    gameLobby: (withStats) => loadGameLobby(db().clubId, me(), withStats),
    gameRoom: (id) => loadGameRoom(id),
    gameSubscribe: (id, on) => subscribeGameRoom(id, on),
    gameHand: (id) => loadGameHand(id),

    /** Mã mời → id phòng. Không có → toast, trả null. */
    gameFind: async (code) => {
      const id = await run(() => findGameRoom(db().clubId, String(code || '').trim().toUpperCase()))
      if (id === true) { toast(t('games.err.notFound')); return null }
      return id
    },

    /** Tạo phòng, trả id. `from` = phòng vừa chơi xong (Chơi lại). */
    gameCreate: (game, options, isPrivate, from = null) => {
      if (!me()) { toast(t('games.err.notMember')); return Promise.resolve(null) }
      return run(() => gameRpc('game_create', {
        p_club: db().clubId, p_game: game, p_options: options || {}, p_private: !!isPrivate, p_from: from,
      }))
    },

    gameJoin: (room) => run(() => gameRpc('game_join', { p_room: room.id, p_max: gameOf(room.game)?.maxPlayers || 2 })),
    gameLeave: (roomId) => run(() => gameRpc('game_leave', { p_room: roomId })),
    gameStart: (room) => {
      const g = gameOf(room.game)
      return run(() => gameRpc('game_start', { p_room: room.id, p_min: g.minPlayers, p_max: g.maxPlayers }))
    },

    /** Ghi một nước. Trả 'ok' · 'stale' (phải nạp lại log, im lặng) · null (lỗi khác, đã toast). */
    gameMove: async (roomId, seq, move) => {
      try {
        await gameRpc('game_move', { p_room: roomId, p_seq: seq, p_move: move })
        return 'ok'
      } catch (e) {
        if (isStale(e)) return 'stale'
        toast(gameErr(e))
        return null
      }
    },

    /** Nhịp "tôi vẫn ở đây" — im lặng: hỏng một nhịp thì nhịp sau bù, không làm phiền người chơi. */
    gamePing: (roomId) => gameRpc('game_ping', { p_room: roomId }).catch(() => null),

    /**
     * Đòi xử những ghế ván đang chờ mà mất kết nối quá lâu (0085: server chỉ xử đúng các ghế này). Im lặng: server
     * chưa đồng ý (lệch giờ, ván vừa có nước mới) thì máy thử lại sau.
     */
    gameClaim: (roomId, seats) => gameRpc('game_claim', { p_room: roomId, p_seats: seats }).then(() => true).catch(() => null),

    /** Báo ván đã xong. Caro: server tự chấm lại từ log, không tin kết quả gửi lên. Server chỉ nhận lần đầu. */
    gameFinish: (roomId, result) => gameRpc('game_finish', { p_room: roomId, p_result: result }).catch((e) => {
      console.warn('[games] Không báo được kết quả:', e?.message || e)
      return null
    }),
  }
}
