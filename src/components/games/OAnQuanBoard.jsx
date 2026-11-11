import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Icon } from '#ds'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import { deadlineOf, isQuanNon, queueStates, sideOf } from '#lib/games/oanquan.js'
import cfg from '#config/app.js'

// Bàn Ô ăn quan kiểu SƠN MÀI (chủ dự án duyệt 2026-11-10, bản thiết kế "O An Quan · 1c Sơn mài"): mặt bàn đỏ son
// viền vàng, ô khoét sâu, sỏi suối nhiều màu, quan là viên ngọc bích. Màu viết cứng trong `L` như bàn fantasy của
// Cờ vua / Cờ tướng (DESIGN.md §2.4) — bàn là một "vật", giữ nguyên ở cả sáng / tối. Chỉ gradient, không filter.
// Hình học đúng bản 1c: bàn 880 × 340 (5 ô một hàng; 6–7 ô thì bàn dài thêm 125 mỗi ô), quan hình con nhộng 120 × 250
// ở hai đầu, ô dân tròn Ø96 cách nhau 125. Bàn 3 quan (tuỳ chọn) là TAM GIÁC: quan ngọc ở ba đỉnh, mỗi người một cạnh.
// Hàng của mình luôn nằm dưới: xoay vòng ô đi (ghế × (số ô một hàng + 1)) — bàn đối xứng xoay, chữ số vẫn đứng
// thẳng; nhờ vậy "sang phải" luôn là dir +1 với hàng của mình.
// Khung sơn mài tự vẽ luôn viên thuốc người chơi (trên = đối thủ, dưới = mình: tên, điểm, lời nhắn, đồng hồ) và nút
// của phòng (prop `actions`) — phòng không vẽ thẻ người chơi riêng nữa (BotRoom `inFrame`).
// Nước vừa đi được diễn lại từng bước (bốc → rải từng viên → ăn) từ `state.last.frames` (lib/games/oanquan.js):
// viên đang cầm là quả cầu vàng chạy theo ô, mỗi viên rơi tạo gợn sóng vàng, ăn quân bung hạt vàng + "+N".
// Nước tới trong lúc đang diễn thì XẾP HÀNG (queueStates), diễn xong nước này mới tới nước kế — không cắt ngang.
// Chạm bàn để xem ngay. Máy bật "giảm chuyển động" thì không diễn.
// Tốc độ diễn ×1 / ×2 / ×3 (cfg.games.oanquanSpeeds, mặc định mức đầu) — mỗi máy tự nhớ, không ảnh hưởng người kia.
// Phòng thật có đồng hồ (options.time, giờ server — deadlineOf): đồng hồ hiện ở viên thuốc của người tới lượt; hết giờ thì
// máy tự báo { timeout } (người tới lượt báo trước, người khác chờ thêm phòng máy kia đã tắt), server đi thay — như Bài bịp.
// Phòng máy (BotRoom) tự đếm giờ và truyền `clock` vào — khi đó không đếm ở đây.

const SPEEDS = cfg.games.oanquanSpeeds
const SPEED_KEY = 'oanquan:speed'
function loadSpeed() {
  try {
    const n = Number(localStorage.getItem(SPEED_KEY))
    return SPEEDS.includes(n) ? n : SPEEDS[0]
  } catch { return SPEEDS[0] }
}

/** Bảng màu sơn mài. Thêm màu thì thêm ở đây, đừng rải hex trong JSX. */
const L = {
  room: 'radial-gradient(700px 360px at 50% 45%, #3a0c0a, transparent 70%), #120303',
  roomEdge: 'rgba(232,195,106,.2)',
  lac: ['#4a0f0c', '#1e0504', '#360a08'], // mặt bàn
  rim: '#b8893a', // viền vàng
  rimIn: '#1e0504',
  pit: ['#0b0202', '#2c0907'], // lòng ô dân
  quanPit: ['#0c0202', '#2a0807'],
  gold: '#e8c36a',
  goldHi: '#f3d58a',
  goldA: (a) => `rgba(232,195,106,${a})`,
  ink: '#2a1600', // chữ trên nền vàng
  text: '#f3e6cc',
  muted: '#b09a7a',
  note: '#d9c6a4',
  pill: 'rgba(40,8,6,.8)',
  red: '#f8a5a5',
  jade: ['#d4ffe6', '#3aa57a', '#0f4a33'],
  rock: ['#d9cbb0', '#6b5d48'],
  stones: ['#d9cbb0', '#9aa39a', '#6f8f7a', '#c2b49a', '#8a8f99', '#b7a58a'],
  shade: 'rgba(0,0,0,.55)',
}

const DAN_R = 48 // ô dân Ø96
const QW = 120 // ô quan 120 × 250
const QH = 250
const QR = 64 // ô quan tròn ở đỉnh bàn tam giác
const MAX_DRAWN = 18 // nhiều hơn thì chỉ còn con số nói

/**
 * Hình học bàn theo tuỳ chọn → { W, H, frame?, cells }. cells[i] = tâm ô i khi chưa xoay + chỗ ghi số (lx, ly);
 * quan: 'L' | 'R' (con nhộng) | 'O' (tròn, bàn tam giác). frame = 3 đỉnh khung bàn tam giác.
 * 2 quan: quan trái (0), hàng dưới 1..R trái → phải, quan phải (R+1), hàng trên phải → trái.
 * 3 quan: quan ở ba đỉnh (trái dưới → phải dưới → trên), hàng ghế 0 là cạnh đáy trái → phải, rồi ngược chiều kim đồng hồ.
 */
function layout({ quans, rows }) {
  const N = quans * (rows + 1)
  if (quans === 2) {
    const right = 190 + (rows - 1) * 125 + 110
    const cells = Array.from({ length: N }, (_, i) => {
      if (i === 0 || i === rows + 1) { const x = i ? right : 80; return { x, y: 170, quan: i ? 'R' : 'L', lx: x, ly: 170 + QH / 2 - 12 } }
      const x = 190 + (i <= rows ? i - 1 : N - 1 - i) * 125
      return i <= rows ? { x, y: 240, lx: x, ly: 240 + DAN_R + 18 } : { x, y: 100, lx: x, ly: 100 - DAN_R - 8 }
    })
    return { W: right + 80, H: 340, cells }
  }
  const gap = 125, d = 112, side = 2 * gap + (rows - 1) * d, h = (side * Math.sqrt(3)) / 2
  const V = [[115, 125 + h], [115 + side, 125 + h], [115 + side / 2, 125]]
  const G = [115 + side / 2, 125 + (h * 2) / 3]
  const out = ([x, y], r) => { const dx = x - G[0], dy = y - G[1], l = Math.hypot(dx, dy); return [x + (dx / l) * r, y + (dy / l) * r] }
  const cells = []
  for (let k = 0; k < 3; k++) {
    const [ax, ay] = V[k], [bx, by] = V[(k + 1) % 3]
    const [qx, qy] = out(V[k], QR + 16)
    cells.push({ x: ax, y: ay, quan: 'O', lx: qx, ly: qy + 4 })
    // Pháp tuyến của cạnh, quay ra ngoài bàn — số sỏi ghi ở phía ngoài.
    let nx = (by - ay) / side, ny = -(bx - ax) / side
    if (nx * ((ax + bx) / 2 - G[0]) + ny * ((ay + by) / 2 - G[1]) < 0) { nx = -nx; ny = -ny }
    for (let j = 0; j < rows; j++) {
      const f = (gap + j * d) / side
      const x = ax + (bx - ax) * f, y = ay + (by - ay) * f
      cells.push({ x, y, lx: x + nx * (DAN_R + 14), ly: y + ny * (DAN_R + 14) + 4 })
    }
  }
  return { W: side + 230, H: 125 + h + 85, cells, frame: V.map((v) => out(v, 80)) }
}

/** Ô quan hình con nhộng: đầu tròn lớn quay ra ngoài bàn, góc nhỏ quay vào trong (bản 1c). */
function quanPath({ x, y, quan }) {
  const x0 = x - QW / 2, x1 = x + QW / 2, y0 = y - QH / 2, y1 = y + QH / 2
  const R = 104, r = 16
  if (quan === 'O') return `M${x - QR} ${y} a${QR} ${QR} 0 1 0 ${2 * QR} 0 a${QR} ${QR} 0 1 0 ${-2 * QR} 0 Z`
  return quan === 'L'
    ? `M${x1 - r} ${y0} A${r} ${r} 0 0 1 ${x1} ${y0 + r} L${x1} ${y1 - r} A${r} ${r} 0 0 1 ${x1 - r} ${y1} A${R} ${R} 0 0 1 ${x0} ${y1 - R} L${x0} ${y0 + R} A${R} ${R} 0 0 1 ${x1 - r} ${y0} Z`
    : `M${x0 + r} ${y0} A${R} ${R} 0 0 1 ${x1} ${y0 + R} L${x1} ${y1 - R} A${R} ${R} 0 0 1 ${x0 + r} ${y1} A${r} ${r} 0 0 1 ${x0} ${y1 - r} L${x0} ${y0 + r} A${r} ${r} 0 0 1 ${x0 + r} ${y0} Z`
}

/** n viên sỏi xếp xoắn ốc (góc vàng) quanh tâm ô — đúng cách bản 1c rải sỏi. Tính sẵn một lần. */
const SPIRAL = Array.from({ length: MAX_DRAWN }, (_, j) => {
  const a = j * 2.39996 + 0.6, r = 8 * Math.sqrt(j + 0.4)
  return [Math.cos(a) * r, Math.sin(a) * r]
})
// Hạt vàng li ti dát trên mặt bàn — vị trí cố định (không ngẫu nhiên mỗi lần vẽ).
const rnd = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x) }
const FLECKS = Array.from({ length: 30 }, (_, j) => ({ fx: rnd(j * 3 + 1), fy: rnd(j * 7 + 2), s: 0.6 + rnd(j) * 1.1, o: 0.35 + rnd(j * 5) * 0.5 }))
// Hạt bung ra khi ăn quân: 22 hướng, quãng bay 60–150.
const SPARKS = Array.from({ length: 22 }, (_, j) => {
  const a = (j / 22) * Math.PI * 2 + rnd(j * 31) * 0.5
  const d = 60 + rnd(j * 17) * 90
  return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, s: 5 + rnd(j) * 5, hi: j % 3 === 0 }
})
const FX = { transformBox: 'fill-box', transformOrigin: 'center' }
const GLIDE = 'transform var(--dur-base) var(--ease-standard)'
const mmss = (sec) => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0')

export default function OAnQuanBoard(props) {
  const { state } = props
  // Chỉ diễn lại nước đi tới trong lúc đang mở phòng; vào phòng giữa ván thì hiện ngay bàn hiện tại.
  const [mountPly] = useState(state.ply)
  const [still] = useState(() => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  // Hàng chờ: q[0] đang hiện, phần sau chờ diễn. Cập nhật ngay trong lúc render (state suy ra từ props).
  const [q, setQ] = useState([state])
  const queue = queueStates(q, state)
  if (queue !== q) setQ(queue)
  const done = useCallback(() => setQ((cur) => (cur.length > 1 ? cur.slice(1) : cur)), [])
  const shown = queue[0]
  const more = queue.length > 1
  // Tốc độ nằm ở đây (Board dựng lại theo từng nước nên không giữ được).
  const [speed, setSpeed] = useState(loadSpeed)
  const pickSpeed = useCallback((n) => {
    setSpeed(n)
    try { localStorage.setItem(SPEED_KEY, String(n)) } catch { /* trình duyệt chặn lưu — bỏ qua */ }
  }, [])
  // Đồng hồ phòng thật: nhích mỗi giây khi có hạn lượt, quá hạn thì báo { timeout } (4 giây thử lại một lần).
  const { mySeat, onMove } = props
  const due = props.clock ? null : deadlineOf(state)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (due == null) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [due])
  const sent = useRef('')
  const P = state.opts.quans
  const seated = mySeat != null && mySeat < P && !!onMove
  useEffect(() => {
    if (due == null || !seated) return
    const at = due + (state.turn === mySeat ? 300 : 2000 + ((mySeat - state.turn + P) % P) * 800)
    if (now < at) return
    const tag = state.ply + ':' + Math.floor((now - at) / 4000)
    if (sent.current === tag) return
    sent.current = tag
    onMove({ timeout: true })
  }, [due, seated, now, mySeat, state.turn, state.ply, P, onMove])
  const clock = props.clock || (due != null ? { seat: state.turn, left: Math.max(0, Math.ceil((due - now) / 1000)), on: true } : null)

  // key theo ply: mỗi nước mới dựng lại Board → bộ đếm khung bắt đầu từ 0, ô đang chọn tự bỏ.
  // Còn nước chờ diễn thì chưa cho đi (bàn đang hiện thế cũ).
  return (
    <Board key={shown.ply} {...props} clock={clock} state={shown} canMove={props.canMove && !more} more={more} onDone={done}
      animate={!still && shown.ply > mountPly} speed={still ? null : speed} onSpeed={pickSpeed} />
  )
}

function Board({ state, mySeat, canMove, onMove, animate, more, onDone, speed, onSpeed, names, note, clock, actions, hint: tip }) {
  const isMobile = useMobile(768)
  const uid = useId().replace(/:/g, '')
  const id = (name) => `oaq-${name}-${uid}`
  const frames = animate && state.last?.frames?.length ? state.last.frames : null
  const [k, setK] = useState(frames ? 0 : null)
  const [picked, setPicked] = useState(null)
  // Ở ×1 cả nước đi diễn trong ~4 giây dù dài hay ngắn; ×N thì nhịp chia N. Khung đầu (lúc bốc) đứng lâu gấp đôi;
  // khung ăn đứng lâu gấp ba cho kịp thấy hạt vàng.
  const tick = frames ? Math.round(Math.max(70, Math.min(240, 4200 / frames.length)) / (speed || 1)) : 0

  useEffect(() => {
    if (k == null) return undefined
    const mul = k === 0 ? 2 : frames[k].kind === 'eat' ? 3 : 1
    const tid = setTimeout(() => setK(k + 1 < frames.length ? k + 1 : null), tick * mul)
    return () => clearTimeout(tid)
  }, [k, frames, tick])
  // Diễn xong (hoặc bị chạm để bỏ qua, hoặc không diễn) mà còn nước chờ → chuyển sang nước kế.
  useEffect(() => { if (k == null && more) onDone() }, [k, more, onDone])

  const f = k == null ? null : frames[k]
  const view = f || state
  const { opts } = state
  const geo = layout(opts)
  const { W, H } = geo
  const N = state.stones.length
  const seats = Array.from({ length: opts.quans }, (_, s) => s)
  const bottom = mySeat != null && mySeat < opts.quans ? mySeat : 0
  const rot = bottom * (opts.rows + 1)
  const at = (i) => geo.cells[(i - rot + N) % N]
  const mine = mySeat == null ? [] : sideOf(state, mySeat)
  const live = canMove && !f
  const sel = live && mine.includes(picked) && state.stones[picked] > 0 ? picked : null
  const taken = new Set(f ? [] : state.last?.taken || [])
  const refilled = f?.kind === 'refill' ? new Set(sideOf(state, f.at)) : null
  // Điểm vừa ăn ở khung 'eat' = điểm người đi tăng so với khung trước.
  const mover = state.last?.seat
  const gained = f?.kind === 'eat' && mover != null ? f.score[mover] - (k > 0 ? frames[k - 1].score[mover] : f.score[mover]) : 0

  const go = (dir) => {
    if (sel == null) return
    setPicked(null)
    onMove({ cell: sel, dir })
  }

  // Lời nhắn ở viên thuốc dưới: đang diễn → "chạm để xem ngay"; tới lượt → hướng dẫn chọn ô; còn lại → lời phòng gửi.
  const hint = f ? t('games.oanquan.skipHint') : live ? t(sel == null ? 'games.oanquan.pickHint' : 'games.oanquan.dirHint') : ''
  const pill = (seat, row) => {
    const on = view.turn === seat && !view.over
    const name = names?.[seat] || t('games.oanquan.mark' + Math.min(seat, 2))
    const msg = row ? hint || note?.[seat] : note?.[seat]
    const me = clock?.seat === seat ? clock : null
    const low = me?.on && me.left <= 5
    return (
      <div key={seat} style={{ ...S.pill, borderColor: on ? L.goldA(0.7) : 'rgba(255,255,255,.1)' }} aria-live={row ? 'polite' : undefined}>
        <span style={{ ...S.ball, background: `radial-gradient(circle at 35% 30%, ${row ? L.jade.join(', ') : L.rock.join(', ')})` }} />
        <span style={{ font: '700 15px/1.2 var(--font-sans)', color: L.text, whiteSpace: 'nowrap' }}>{name}</span>
        <span style={{ font: '700 20px/1 var(--font-mono)', color: L.gold }}>{view.score[seat]}</span>
        {msg && <span style={{ font: '400 13px/1.3 var(--font-sans)', color: L.note, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msg}</span>}
        {me && (
          <span role="timer" aria-label={t('games.bot.time')} style={{
            marginLeft: 4, padding: '4px 10px', borderRadius: 99, font: '700 15px/1 var(--font-mono)', flexShrink: 0,
            background: !me.on ? 'transparent' : low ? '#c0392b' : L.goldA(0.18), color: !me.on ? L.muted : low ? '#fff' : L.goldHi,
            border: '1px solid ' + (me.on ? L.goldA(0.5) : L.goldA(0.2)),
          }}>{mmss(me.left)}</span>
        )}
      </div>
    )
  }

  return (
    <div style={{ ...S.room, padding: isMobile ? '16px 10px 18px' : '28px 48px 32px', gap: isMobile ? 14 : 20 }}>
      <div style={{ alignSelf: 'stretch', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...S.title, fontSize: isMobile ? 26 : 36 }}>{t('games.oanquan.name')}</div>
          <div style={S.sub}>{t('games.oanquan.lacquerSub')}</div>
        </div>
        {actions?.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {actions.map((a) => (
              <button key={a.key} type="button" disabled={a.off} onClick={a.on} title={a.label} aria-label={a.label}
                style={{ ...S.goldBtn(false), opacity: a.off ? 0.4 : 1, cursor: a.off ? 'default' : 'pointer', color: a.danger ? L.red : L.gold, borderColor: a.danger ? 'rgba(248,165,165,.4)' : L.goldA(0.45) }}>
                <Icon name={a.icon} size={15} />{!isMobile && a.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '100%' }}>
        {seats.filter((x) => x !== bottom).map((x) => pill(x, 0))}
      </div>

      <svg
        data-game-fx
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-label={t('games.oanquan.boardAria')}
        onClick={f ? () => setK(null) : undefined}
        style={{ width: '100%', maxWidth: W, display: 'block', touchAction: 'manipulation', userSelect: 'none', cursor: f ? 'pointer' : 'default', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={id('lac')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={L.lac[0]} /><stop offset=".55" stopColor={L.lac[1]} /><stop offset="1" stopColor={L.lac[2]} />
          </linearGradient>
          <radialGradient id={id('pit')} cx=".5" cy=".42" r=".6">
            <stop offset="0" stopColor={L.pit[0]} /><stop offset=".72" stopColor={L.pit[1]} />
          </radialGradient>
          <radialGradient id={id('qpit')} cx=".5" cy=".45" r=".6">
            <stop offset="0" stopColor={L.quanPit[0]} /><stop offset=".75" stopColor={L.quanPit[1]} />
          </radialGradient>
          <radialGradient id={id('jade')} cx=".35" cy=".3" r=".75">
            <stop offset="0" stopColor={L.jade[0]} /><stop offset=".5" stopColor={L.jade[1]} /><stop offset="1" stopColor={L.jade[2]} />
          </radialGradient>
          <linearGradient id={id('gold')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={L.goldHi} /><stop offset="1" stopColor={L.rim} />
          </linearGradient>
          <radialGradient id={id('orb')} cx=".35" cy=".3" r=".7">
            <stop offset="0" stopColor="#fff3c4" /><stop offset=".5" stopColor={L.gold} /><stop offset="1" stopColor="#8a6216" />
          </radialGradient>
          <radialGradient id={id('halo')} cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor={L.goldA(0.55)} /><stop offset="1" stopColor={L.goldA(0)} />
          </radialGradient>
        </defs>

        {/* Mặt bàn: viền vàng 3px, vòng tối 8px, rồi một chỉ vàng mảnh bên trong (bản 1c). Tam giác: nét dày bo tròn góc
            vẽ chồng (viền vàng dưới, mặt son trên) — không có chỉ vàng / hạt vàng. */}
        {geo.frame ? (() => {
          const pts = geo.frame.map((v) => v.join(',')).join(' ')
          return (
            <>
              <polygon points={pts} fill={L.rim} stroke={L.rim} strokeWidth={86} strokeLinejoin="round" />
              <polygon points={pts} fill={`url(#${id('lac')})`} stroke={L.lac[1]} strokeWidth={80} strokeLinejoin="round" />
              <polygon points={pts} fill="none" stroke={L.goldA(0.35)} strokeDasharray="3 5" />
            </>
          )
        })() : (
          <>
            <rect x={1.5} y={1.5} width={W - 3} height={H - 3} rx={30} fill={`url(#${id('lac')})`} stroke={L.rim} strokeWidth={3} />
            <rect x={7} y={7} width={W - 14} height={H - 14} rx={25} fill="none" stroke={L.rimIn} strokeWidth={8} />
            <rect x={11.5} y={11.5} width={W - 23} height={H - 23} rx={21} fill="none" stroke={L.goldA(0.45)} />
            {FLECKS.map((p, j) => <circle key={j} cx={20 + p.fx * (W - 40)} cy={16 + p.fy * (H - 32)} r={p.s} fill={L.goldHi} opacity={p.o} />)}
            <line x1={150} y1={169.5} x2={W - 150} y2={169.5} stroke={L.goldA(0.35)} strokeDasharray="3 5" />
          </>
        )}

        {view.stones.map((n, i) => {
          const b = at(i)
          const hasQuan = view.quan[i]
          const non = isQuanNon(view, i)
          const tap = live && mine.includes(i) && n > 0
          const hot = f && f.at === i
          const on = sel === i || hot
          const stroke = on ? L.gold : tap ? L.goldA(0.75) : L.goldA(b.quan ? 0.55 : 0.45)
          // Đống sỏi: ô dân quanh tâm; ô quan nằm dưới viên ngọc. jy = tâm viên ngọc (quan tròn thấp hơn, nhỏ hơn).
          const round = b.quan === 'O'
          const py = b.quan ? b.y + (hasQuan ? (round ? 24 : 50) : 0) : b.y
          const sx = b.quan ? 0.9 : 1
          const jy = b.y - (round ? 18 : 44)
          const shape = (props) => (b.quan ? <path d={quanPath(b)} {...props} /> : <circle cx={b.x} cy={b.y} r={DAN_R} {...props} />)
          return (
            <g key={i} onClick={tap ? () => setPicked(picked === i ? null : i) : undefined}
              role={tap ? 'button' : undefined} aria-label={tap ? t('games.oanquan.cellAria', { n }) : undefined}
              style={{ cursor: tap ? 'pointer' : undefined }}>
              {on && shape({ fill: 'none', stroke: L.goldA(0.25), strokeWidth: 10 })}
              {shape({ fill: `url(#${id(b.quan ? 'qpit' : 'pit')})`, stroke, strokeWidth: on ? 2.4 : 1.5, strokeDasharray: !f && state.last?.cell === i ? '6 4' : undefined })}
              {/* Bóng tối mép trên lòng ô cho cảm giác khoét sâu. */}
              {shape({ fill: 'none', stroke: L.shade, strokeWidth: 7, opacity: 0.55, pointerEvents: 'none' })}
              {taken.has(i) && shape({ fill: L.goldA(0.16), pointerEvents: 'none' })}
              {refilled?.has(i) && shape({ fill: L.goldA(0.22), pointerEvents: 'none' })}

              {hasQuan && (
                <g opacity={non ? 0.55 : 1}>
                  <ellipse cx={b.x + 2} cy={jy + 8} rx={30} ry={26} fill={L.shade} />
                  <path d={`M${b.x - 29} ${jy} C${b.x - 30} ${jy - 26} ${b.x + 26} ${jy - 30} ${b.x + 30} ${jy - 2} C${b.x + 33} ${jy + 24} ${b.x - 26} ${jy + 30} ${b.x - 29} ${jy} Z`}
                    fill={`url(#${id('jade')})`} />
                  <ellipse cx={b.x - 10} cy={jy - 14} rx={8} ry={4.5} fill="#fff" opacity={0.4} />
                  {non && <ellipse cx={b.x} cy={jy} rx={38} ry={33} fill="none" stroke={L.gold} strokeDasharray="3 4" />}
                </g>
              )}
              {/* Viên cũ trượt về chỗ mới khi ô thêm sỏi; chỉ viên VỪA RƠI (hoặc vừa rải lại) mới hiện dần. */}
              {SPIRAL.slice(0, Math.min(n, MAX_DRAWN)).map(([dx, dy], s, all) => (
                <g key={s} style={{ transform: `translate(${b.x + dx}px, ${py + dy * sx}px)`, transition: GLIDE }}>
                  <g style={refilled?.has(i) || (hot && f.kind === 'drop' && s === all.length - 1) ? { ...FX, animation: 'gamePop var(--dur-base) var(--ease-standard) both' } : undefined}>
                    <ellipse cx={0.7} cy={1.5} rx={6} ry={5.5} fill={L.shade} />
                    <ellipse rx={6} ry={5.5} fill={L.stones[s % L.stones.length]} />
                    <ellipse cx={-1.9} cy={-1.9} rx={2.3} ry={1.5} fill="#fff" opacity={0.45} />
                  </g>
                </g>
              ))}

              {(n > 0 || hasQuan) && (
                <text x={b.lx} y={b.ly} textAnchor="middle" fontSize={b.quan ? 13 : 12} fontWeight={700} fill={L.gold} style={{ fontFamily: 'var(--font-mono)' }}>{n}</text>
              )}
              {non && (
                <text x={b.x} y={round ? b.y + 52 : b.y - 2} textAnchor="middle" fontSize={11} fill={L.note}>{t('games.oanquan.young')}</text>
              )}
            </g>
          )
        })}

        {/* Hiệu ứng của khung đang diễn: gợn sóng vàng khi bốc / rơi, ăn quân thì bung hạt + "+N". */}
        {f && (() => {
          const { x, y } = at(f.at)
          if (f.kind === 'eat') {
            const them = mover != null && mover !== mySeat && mySeat != null
            return (
              <g key={'fx' + k} pointerEvents="none">
                <circle cx={x} cy={y} r={80} fill="none" stroke={L.gold} strokeWidth={3} style={{ ...FX, animation: 'oaqRipple 1.1s ease-out both' }} />
                {SPARKS.map((p, j) => (
                  <rect key={j} x={x - p.s / 2} y={y - p.s / 2} width={p.s} height={p.s} rx={1} fill={p.hi ? '#fff1c2' : L.gold}
                    style={{ ...FX, '--dx': p.dx + 'px', '--dy': p.dy + 'px', animation: `oaqBurst ${1 + (j % 5) * 0.1}s cubic-bezier(.15,.7,.3,1) both` }} />
                ))}
                {gained > 0 && (
                  <text x={x} y={y} textAnchor="middle" fontSize={34} fontWeight={800} fill={them ? L.red : L.goldHi} stroke={L.lac[1]} strokeWidth={3} paintOrder="stroke"
                    style={{ ...FX, fontFamily: 'var(--font-display)', animation: 'oaqFloat 1.8s ease-out both' }}>+{gained}</text>
                )}
              </g>
            )
          }
          return (
            <circle key={'fx' + k} cx={x} cy={y} r={f.kind === 'pick' ? 55 : 50} fill="none" stroke={L.goldA(0.9)} strokeWidth={2}
              pointerEvents="none" style={{ ...FX, animation: 'oaqRipple 1s ease-out both' }} />
          )
        })()}

        {/* Quả cầu vàng = nắm sỏi đang cầm, trượt theo ô đang rải; số trên đầu là số viên còn trong tay. */}
        {f && f.hand > 0 && (() => {
          const { x, y } = at(f.at)
          return (
            <g pointerEvents="none" style={{ transform: `translate(${x}px, ${y}px)`, transition: 'transform 220ms cubic-bezier(.4,0,.2,1)' }}>
              <circle r={26} fill={`url(#${id('halo')})`} />
              <circle r={12} fill={`url(#${id('orb')})`} />
              <rect x={-14} y={-34} width={28} height={16} rx={8} fill="rgba(0,0,0,.75)" />
              <text y={-22} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff" style={{ fontFamily: 'var(--font-mono)' }}>×{f.hand}</text>
            </g>
          )
        })()}

        {/* Gợi ý (phòng máy): vòng vàng quanh ô nên bốc + mũi tên chiều rải, nhấp nháy; chạm mũi tên là đi luôn. */}
        {live && sel == null && tip && state.stones[tip.cell] > 0 && (() => {
          const { x, y } = at(tip.cell)
          const ax = x + tip.dir * 30
          return (
            <g onClick={(e) => { e.stopPropagation(); onMove({ cell: tip.cell, dir: tip.dir }) }} role="button" aria-label={t('games.bot.hint')}
              style={{ cursor: 'pointer', animation: 'chHint 1.2s ease-in-out infinite' }}>
              <circle cx={x} cy={y} r={44} fill="none" stroke={L.gold} strokeWidth={3} strokeDasharray="7 6" />
              <circle cx={ax} cy={y} r={20} fill={`url(#${id('gold')})`} />
              <path d={`M${ax - tip.dir * 5} ${y - 7} L${ax + tip.dir * 5} ${y} L${ax - tip.dir * 5} ${y + 7}`}
                fill="none" stroke={L.ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            </g>
          )
        })()}

        {sel != null && (() => {
          const { x, y } = at(sel)
          return (
            <g>
              {[-1, 1].map((dir) => {
                const ax = x + dir * 30
                return (
                  <g key={dir} onClick={(e) => { e.stopPropagation(); go(dir) }} style={{ cursor: 'pointer' }} role="button"
                    aria-label={t(dir === 1 ? 'games.oanquan.sowRight' : 'games.oanquan.sowLeft')}>
                    <circle cx={ax} cy={y + 4} r={20} fill={L.shade} />
                    <circle cx={ax} cy={y} r={20} fill={`url(#${id('gold')})`} />
                    <path d={`M${ax - dir * 5} ${y - 7} L${ax + dir * 5} ${y} L${ax - dir * 5} ${y + 7}`}
                      fill="none" stroke={L.ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                )
              })}
            </g>
          )
        })()}
      </svg>

      {pill(bottom, 1)}

      {/* Màn nhỏ: mũi tên trên bàn bé quá, thêm hai nút rải to dưới bàn. */}
      {isMobile && sel != null && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button type="button" style={S.goldBtn(false)} onClick={() => go(-1)}>← {t('games.oanquan.sowLeft')}</button>
          <button type="button" style={S.goldBtn(true)} onClick={() => go(1)}>{t('games.oanquan.sowRight')} →</button>
        </div>
      )}

      {/* Tốc độ diễn lại. Máy bật "giảm chuyển động" (không diễn) thì ẩn. */}
      {speed != null && (
        <div role="group" aria-label={t('games.oanquan.speed')} style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
          <span style={S.hint}>{t('games.oanquan.speed')}</span>
          {SPEEDS.map((n) => (
            <button key={n} type="button" aria-pressed={speed === n} onClick={() => onSpeed(n)} style={S.speed(speed === n)}>
              {t('games.oanquan.speedOpt', { n })}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const S = {
  room: { display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: 24, background: L.room, border: '1px solid ' + L.roomEdge, minWidth: 0 },
  title: { font: '800 36px/1 var(--font-display)', color: L.gold },
  sub: { font: '400 13px/1.3 var(--font-sans)', color: L.muted, marginTop: 6 },
  hint: { font: 'var(--type-caption)', color: L.muted, textAlign: 'center' },
  pill: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '6px 18px 6px 6px', borderRadius: 99, maxWidth: '100%', minWidth: 0,
    background: L.pill, border: '1px solid', transition: 'border-color .2s',
  },
  ball: { width: 34, height: 34, borderRadius: 99, flexShrink: 0 },
  goldBtn: (main) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 12, cursor: 'pointer', font: '700 13px/1 var(--font-sans)', whiteSpace: 'nowrap',
    background: main ? `linear-gradient(180deg, ${L.goldHi}, ${L.rim})` : 'transparent', color: main ? L.ink : L.gold,
    border: '1px solid ' + (main ? L.rim : L.goldA(0.45)),
  }),
  speed: (on) => ({
    padding: '6px 12px', borderRadius: 99, cursor: 'pointer', font: '700 12.5px/1 var(--font-mono)',
    background: on ? L.goldA(0.16) : 'transparent', color: on ? L.gold : L.muted, border: '1px solid ' + (on ? L.goldA(0.6) : L.goldA(0.2)),
  }),
}
