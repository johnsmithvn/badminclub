// Web Worker: máy nghĩ ở luồng riêng, màn hình không đứng. Nhận { id, gameId, state, seat, level } → trả { id, move }.
import { think } from '#lib/games/bots/index.js'

self.onmessage = (e) => {
  const { id, gameId, state, seat, level } = e.data
  let move = null
  try { move = think(gameId, state, seat, level) } catch (err) { console.warn('[bot]', err) }
  self.postMessage({ id, move })
}
