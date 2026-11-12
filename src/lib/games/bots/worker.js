// Web Worker: máy nghĩ ở luồng riêng, màn hình không đứng. Nhận { id, gameId, state, seat, level, hand } → trả { id, move }.
// `hand` = bài trên tay của chính ghế máy (game bài), không có thì rỗng.
import { think } from '#lib/games/bots/index.js'

self.onmessage = (e) => {
  const { id, gameId, state, seat, level, hand } = e.data
  let move = null
  try { move = think(gameId, state, seat, level, Math.random, undefined, hand) } catch (err) { console.warn('[bot]', err) }
  self.postMessage({ id, move })
}
