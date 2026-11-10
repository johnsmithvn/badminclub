// Mức Cao thủ: engine cờ nhúng, nói chuyện bằng giao thức UCI. File engine nằm ở public/engines (tải lười — chỉ
// người chọn Cao thủ mới tải). Cả hai là GPL-3.0, giữ nguyên file Copying.txt cạnh engine.
//   Cờ vua:   Stockfish 18 lite single-thread (stockfish.js của nmrugg, ~7 MB) — chạy trong Web Worker, mọi
//             trình duyệt hiện đại (iOS 16+).
//   Cờ tướng: Fairy-Stockfish 1.1.12 (~1,7 MB) — bản WASM này chạy đa luồng nên cần SharedArrayBuffer, tức trang phải
//             được "cách ly" (header COOP + COEP — vercel.json / vite.config.js chỉ bật cho /tro-choi/may-cotuong).
//             Safari / iPhone chưa hỗ trợ COEP credentialless → không cách ly được → `engineMove` ném lỗi và màn
//             chơi lùi về bộ não tự viết mức Khó (nghĩ lâu hơn).
// Đa dạng: 10 nửa nước đầu xin engine 3 phương án (MultiPV), chọn ngẫu nhiên trong các nước kém nước tốt nhất ≤ 25
// điểm (1/4 con tốt) — khai cuộc không ván nào giống ván nào, sau đó đánh nước tốt nhất.

import { COLS as XQ_COLS, ROWS as XQ_ROWS } from '#lib/games/cotuong.js'

const ENGINES = {
  covua: '/engines/stockfish/stockfish-18-lite-single.js',
  cotuong: '/engines/fairy-stockfish/stockfish.js',
}
const OPENING_PLY = 10
const OPENING_MARGIN = 25

// ── Đổi thế cờ / nước đi ────────────────────────────────────────────────────────────────────────────────────────
const fenRows = (board, cols, rows, map = (p) => p) => {
  const out = []
  for (let r = 0; r < rows; r++) {
    let line = ''
    let gap = 0
    for (let c = 0; c < cols; c++) {
      const p = board[r * cols + c]
      if (p == null) { gap++; continue }
      if (gap) { line += gap; gap = 0 }
      line += map(p)
    }
    out.push(line + (gap || ''))
  }
  return out.join('/')
}
const sqName = (i) => 'abcdefgh'[i & 7] + (8 - (i >> 3))

/** FEN chuẩn của thế cờ vua (covua.js: ô 0 = a8). */
export function chessFen(s) {
  return [fenRows(s.board, 8, 8), s.turn === 0 ? 'w' : 'b', s.castle || '-', s.ep != null ? sqName(s.ep) : '-', s.half, Math.floor(s.ply / 2) + 1].join(' ')
}

// cotuong.js: K tướng A sĩ E tượng H mã R xe C pháo P tốt → kí hiệu Fairy-Stockfish: k a b n r c p.
const XQ_TO = { K: 'K', A: 'A', E: 'B', H: 'N', R: 'R', C: 'C', P: 'P' }
/** FEN cờ tướng kiểu Fairy-Stockfish (đỏ = chữ hoa = 'w', hàng 10 ở trên). */
export function xiangqiFen(s) {
  const map = (p) => (p === p.toUpperCase() ? XQ_TO[p] : XQ_TO[p.toUpperCase()].toLowerCase())
  return [fenRows(s.board, XQ_COLS, XQ_ROWS, map), s.turn === 0 ? 'w' : 'b', '-', '-', 0, Math.floor(s.ply / 2) + 1].join(' ')
}

/** Nước UCI ('e2e4', 'a7a8q', cờ tướng 'h3e3' / 'a10a9') → nước của game. */
export function fromUci(id, s, uci) {
  const m = /^([a-i])(\d+)([a-i])(\d+)([qrbn])?$/.exec(uci || '')
  if (!m) return null
  const [cols, rows] = id === 'covua' ? [8, 8] : [XQ_COLS, XQ_ROWS]
  const at = (f, r) => (rows - Number(r)) * cols + (f.charCodeAt(0) - 97)
  const move = { from: at(m[1], m[2]), to: at(m[3], m[4]) }
  return m[5] ? { ...move, promo: m[5] } : move
}

// ── Chạy engine (chỉ trình duyệt) ───────────────────────────────────────────────────────────────────────────────
const live = {} // id → Promise<{ send(cmd), listen(fn) }>

function loadScript(src) {
  return new Promise((ok, fail) => {
    const el = document.createElement('script')
    el.src = src
    el.onload = ok
    el.onerror = () => fail(new Error('engine-load'))
    document.head.appendChild(el)
  })
}

async function boot(id) {
  if (id === 'covua') {
    const w = new Worker(ENGINES.covua)
    const fns = new Set()
    w.onmessage = (e) => { for (const f of fns) f(String(e.data)) }
    w.onerror = () => { for (const f of fns) f(null) } // không tải được / engine sập → until() báo lỗi ngay
    return { send: (c) => w.postMessage(c), listen: (f) => { fns.add(f); return () => fns.delete(f) }, stop: () => w.terminate() }
  }
  if (!self.crossOriginIsolated) throw new Error('engine-isolation')
  await loadScript(ENGINES.cotuong)
  const sf = await window.Stockfish()
  const fns = new Set()
  sf.addMessageListener((line) => { for (const f of fns) f(line) })
  return { send: (c) => sf.postMessage(c), listen: (f) => { fns.add(f); return () => fns.delete(f) } }
}

/** Chờ tới dòng thoả `done`; trong lúc chờ đưa từng dòng cho `each`. */
function until(eng, done, each, ms = 20000) {
  return new Promise((ok, fail) => {
    const timer = setTimeout(() => { off(); fail(new Error('engine-timeout')) }, ms)
    const off = eng.listen((line) => {
      if (line == null) { clearTimeout(timer); off(); fail(new Error('engine-crash')); return }
      each?.(line)
      if (done(line)) { clearTimeout(timer); off(); ok(line) }
    })
  })
}

const queue = {} // id → lượt hỏi trước. Engine trả lời từng câu một: hỏi chồng (ván mới lúc máy đang nghĩ) thì
// 'bestmove' của câu cũ sẽ bị câu mới nhận nhầm.

/** Nước của engine cho thế `s` (bên tới lượt). Lỗi (không tải được / không cách ly) → ném để màn chơi lùi về mức Khó. */
export function engineMove(id, s, opt) {
  const run = (queue[id] || Promise.resolve()).catch(() => {}).then(() => ask(id, s, opt))
  queue[id] = run
  return run
}

async function ask(id, s, opt) {
  try {
    return await search(id, s, opt)
  } catch (e) {
    // Engine treo / sập: bỏ engine này, lần sau dựng lại (thay vì lần nào cũng chờ hết hạn).
    const dead = live[id]
    delete live[id]
    dead?.then((eng) => eng.stop?.(), () => {})
    throw e
  }
}

async function search(id, s, { ms = 1000, rand = Math.random } = {}) {
  if (!live[id]) {
    live[id] = boot(id).then(async (eng) => {
      const ready = until(eng, (l) => l === 'uciok')
      eng.send('uci')
      await ready
      if (id === 'cotuong') eng.send('setoption name UCI_Variant value xiangqi')
      return eng
    })
  }
  const eng = await live[id]
  const multi = s.ply < OPENING_PLY ? 3 : 1
  eng.send('setoption name MultiPV value ' + multi)
  const ready = until(eng, (l) => l === 'readyok')
  eng.send('isready')
  await ready
  const lines = {} // multipv → { score, move }
  const each = (l) => {
    const m = /\bmultipv (\d+) .*\bscore (cp|mate) (-?\d+).*?\bpv (\S+)/.exec(l)
    if (m) lines[m[1]] = { v: m[2] === 'mate' ? Math.sign(Number(m[3])) * 1e5 : Number(m[3]), move: m[4] }
  }
  const best = until(eng, (l) => l.startsWith('bestmove'), each, ms + 15000)
  eng.send('position fen ' + (id === 'covua' ? chessFen(s) : xiangqiFen(s)))
  eng.send('go movetime ' + ms)
  let uci = (await best).split(' ')[1]
  const opts = Object.values(lines)
  if (multi > 1 && opts.length > 1) {
    const top = Math.max(...opts.map((o) => o.v))
    const ok = opts.filter((o) => o.v >= top - OPENING_MARGIN)
    uci = ok[Math.floor(rand() * ok.length)].move
  }
  return fromUci(id, s, uci)
}
