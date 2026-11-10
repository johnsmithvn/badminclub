// Danh sách game + hàm dùng chung cho mọi game. Thuần: không React, không Supabase.
// Thêm game = thêm file theo hợp đồng ở docs/GAMES.md §3 rồi thêm một dòng vào GAMES.

import caro from '#lib/games/caro.js'
import oanquan from '#lib/games/oanquan.js'
import coganh from '#lib/games/coganh.js'
import colat from '#lib/games/colat.js'
import chamo from '#lib/games/chamo.js'
import tienlen from '#lib/games/tienlen.js'
import covua from '#lib/games/covua.js'
import cotuong from '#lib/games/cotuong.js'
import cangua from '#lib/games/cangua.js'
import bantau from '#lib/games/bantau.js'
import domino from '#lib/games/domino.js'
import baibip from '#lib/games/baibip.js'
import noitu from '#lib/games/noitu.js'
import masoi from '#lib/games/masoi.js'
import coup from '#lib/games/coup.js'
import baucua from '#lib/games/baucua.js'
import loto from '#lib/games/loto.js'
import xidach from '#lib/games/xidach.js'
import phom from '#lib/games/phom.js'

export const GAMES = { caro, oanquan, coganh, colat, chamo, tienlen, covua, cotuong, cangua, bantau, domino, baibip, noitu, masoi,
  coup, baucua, loto, xidach, phom }

export const GAME_IDS = Object.keys(GAMES)

/** Trò có chế độ chơi với máy (lib/games/bots) — vào bằng /tro-choi/may-<id> (GameRoom.jsx tách sang BotRoom). */
export const BOT_GAMES = ['caro', 'covua', 'cotuong', 'oanquan', 'coganh', 'chamo', 'cangua', 'bantau']
export const BOT_PREFIX = 'may-'

export const gameOf = (id) => GAMES[id] || null

/** Ghế ngồi theo thứ tự của những người CHƯA rời phòng. */
export const seatedOf = (players) => (players || []).filter((p) => !p.leftAt).sort((x, y) => x.seat - y.seat)

/**
 * Người của ván, theo ghế: người còn ngồi + người rời SAU khi ván bắt đầu — họ vẫn có lượt trong log (luật bỏ qua
 * bằng nước { out }) và vẫn cần tên trên bàn. Ghế của họ là tham số `seats` của setup: đếm bằng seatedOf thì ván
 * 3–4 người có người rời bị dựng lại thành ván ít ghế hơn.
 * Người rời lúc còn chờ không tính: game_start không đánh số lại ghế của họ, có thể trùng số với người đang ngồi.
 */
export const inGameOf = (room) => (room?.players || [])
  .filter((p) => !p.leftAt || (room.startedAt && Date.parse(p.leftAt) >= Date.parse(room.startedAt)))
  .sort((x, y) => x.seat - y.seat)

/**
 * Dựng lại state từ log nước đi. Nước không hợp lệ bị BỎ QUA — máy nào cũng bỏ như nhau,
 * nên một client sửa code để gửi nước bậy chỉ tạo dòng rác mà không ai áp dụng.
 * `moves` phải xếp theo `seq` tăng dần. `apply` nhận thêm cả dòng log (`m.at` = giờ server ghi nước) cho game
 * tính giờ theo server (Nối từ); game khác bỏ qua tham số này.
 */
export function replay(game, { options, seed, seats }, moves) {
  let s = game.setup({ options, seed, seats })
  for (const m of moves || []) {
    if (game.validate(s, m.seat, m.move) == null) s = game.apply(s, m.seat, m.move, m)
  }
  return s
}

/** seq của nước tiếp theo: liền sau nước cuối trong log (kể cả nước bị bỏ qua). */
export const nextSeq = (moves) => (moves?.length ? moves[moves.length - 1].seq + 1 : 1)

/** Log có liền mạch 1, 2, 3… không. Hụt một nước (mất mạng) thì phải nạp lại cả log. */
export const isContiguous = (moves) => (moves || []).every((m, i) => m.seq === i + 1)

/**
 * Thắng / thua / hoà của MÌNH theo từng game. `finished` = [{ game, result, seat }] với `seat` là
 * ghế của mình trong ván đó (storage.js: loadGameLobby). Ván không có kết quả thì bỏ.
 */
export function statsOf(finished) {
  const out = {}
  for (const f of finished || []) {
    if (!f.result || f.seat == null) continue
    const s = out[f.game] || (out[f.game] = { w: 0, l: 0, d: 0 })
    if (f.result.draw) s.d += 1
    else if ((f.result.winners || []).includes(f.seat)) s.w += 1
    else s.l += 1
  }
  return out
}

/**
 * Người ngồi ghế còn kết nối không, theo nhịp gần nhất (`seenAt`, server ghi qua game_ping / game_move).
 *   offline: quá `offlineSec` giây không thấy nhịp — hiện "mất kết nối"
 *   leftSec: còn bao nhiêu giây nữa thì đối thủ đòi xử thắng được (≤ 0 = được đòi ngay)
 * Đồng hồ máy khách có thể lệch server; lệch thì server từ chối game_claim và máy thử lại sau.
 */
export function idleOf(player, now, { offlineSec, graceSec }) {
  const seen = player?.seenAt ? new Date(player.seenAt).getTime() : now
  const gone = (now - seen) / 1000
  return { offline: gone > offlineSec, leftSec: Math.ceil(graceSec - gone) }
}

/** Phòng đang chờ quá `hours` giờ thì coi như bỏ — sảnh ẩn đi. */
export const isStaleRoom = (room, now, hours) =>
  room.status === 'waiting' && now - new Date(room.createdAt).getTime() > hours * 3600 * 1000
