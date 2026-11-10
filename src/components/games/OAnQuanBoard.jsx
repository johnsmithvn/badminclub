import { useCallback, useEffect, useId, useState } from 'react'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import { isQuanNon, queueStates, sideOf } from '#lib/games/oanquan.js'
import cfg from '#config/app.js'

// Bàn Ô ăn quan kiểu SƠN MÀI (chủ dự án duyệt 2026-11-10, bản thiết kế "O An Quan · 1c Sơn mài"): mặt bàn đỏ son
// viền vàng, ô khoét sâu, sỏi suối nhiều màu, quan là viên ngọc bích. Màu viết cứng trong `L` như bàn fantasy của
// Cờ vua / Cờ tướng (DESIGN.md §2.4) — bàn là một "vật", giữ nguyên ở cả sáng / tối. Chỉ gradient, không filter.
// Hàng của mình luôn nằm dưới: ghế 1 thì đọc ô i ở vị trí của ô i+6 (bàn đối xứng tâm), chữ số vẫn đứng
// thẳng; nhờ vậy "sang phải" luôn là dir +1 với hàng của mình.
// Nước vừa đi được diễn lại từng bước (bốc → rải từng viên → ăn) từ `state.last.frames` (lib/games/oanquan.js):
// viên đang cầm là quả cầu vàng chạy theo ô, mỗi viên rơi tạo gợn sóng vàng, ăn quân bung hạt vàng + "+N".
// Nước tới trong lúc đang diễn thì XẾP HÀNG (queueStates), diễn xong nước này mới tới nước kế — không cắt ngang.
// Chạm bàn để xem ngay. Máy bật "giảm chuyển động" thì không diễn.
// Tốc độ diễn ×1 / ×2 / ×3 (cfg.games.oanquanSpeeds, mặc định mức đầu) — mỗi máy tự nhớ, không ảnh hưởng người kia.

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
  roomEdge: 'rgba(232,195,106,.22)',
  lac: ['#4a0f0c', '#1e0504', '#360a08'], // mặt bàn
  rim: '#b8893a', // viền vàng
  rimIn: '#1e0504',
  pit: ['#0b0202', '#2c0907'], // lòng ô
  gold: '#e8c36a',
  goldHi: '#f3d58a',
  goldA: (a) => `rgba(232,195,106,${a})`,
  ink: '#2a1600', // chữ trên nền vàng
  text: '#f3e6cc',
  muted: '#d9c6a4',
  jade: ['#d4ffe6', '#3aa57a', '#0f4a33'],
  stones: ['#d9cbb0', '#9aa39a', '#6f8f7a', '#c2b49a', '#8a8f99', '#b7a58a'],
  shade: 'rgba(0,0,0,.55)',
}

const C = 80 // cạnh một ô dân
const PAD = 12 // viền quanh các ô
const BAND = 30 // dải ghi điểm trên / dưới
const W = C * 7 + PAD * 2
const H = BAND * 2 + C * 2 + PAD * 2
const MID = BAND + PAD + C // đường giữa hai hàng
const DAN_R = 34 // bán kính ô dân

/** Khung của ô i khi chưa xoay: quan trái (0), hàng dưới 1..5, quan phải (6), hàng trên 11..7. */
function slot(i) {
  const y = BAND + PAD
  if (i === 0) return { x: PAD, y, w: C, h: C * 2, quan: 'L' }
  if (i === 6) return { x: PAD + C * 6, y, w: C, h: C * 2, quan: 'R' }
  return i < 6 ? { x: PAD + C * i, y: y + C, w: C, h: C } : { x: PAD + C * (12 - i), y, w: C, h: C, top: true }
}

/** Ô quan: nửa hình tròn ôm đầu bàn. Ô dân vẽ bằng <circle>. */
function quanPath(b) {
  const x0 = b.x + 5, x1 = b.x + b.w - 5, y0 = b.y + 6, y1 = b.y + b.h - 6
  const R = (b.h - 12) / 2
  return b.quan === 'L' ? `M${x1} ${y0} A${R} ${R} 0 0 0 ${x1} ${y1} Z` : `M${x0} ${y0} A${R} ${R} 0 0 1 ${x0} ${y1} Z`
}

/** Tâm ô. Ô quan: trọng tâm nửa hình tròn (4R / 3π ≈ 32 tính từ cạnh thẳng) — hai quan đối xứng qua giữa bàn. */
const centerOf = (b) => ({ cx: b.quan === 'L' ? b.x + b.w - 37 : b.quan === 'R' ? b.x + 37 : b.x + b.w / 2, cy: b.y + b.h / 2 })

const GAP = 11.6 // khoảng cách tâm hai viên kề nhau
const MAX_DRAWN = 18 // nhiều hơn thì chỉ còn con số nói
const ringR = (k) => (k < 2 ? 0 : GAP / (2 * Math.sin(Math.PI / k)))
const ring = (k, r) => Array.from({ length: k }, (_, j) => {
  // Lẻ: một viên ở đỉnh. Chẵn: xoay nửa bước cho cặp trên cùng nằm ngang.
  const a = -Math.PI / 2 + (k % 2 ? 0 : Math.PI / k) + (j * 2 * Math.PI) / k
  return [r * Math.cos(a), r * Math.sin(a)]
})
/**
 * Vị trí n viên sỏi quanh tâm ô, luôn cân: tới 5 viên xếp một vòng đều (2 = cặp ngang, 3 = tam giác, 4 = vuông…),
 * 6–9 viên một viên giữa + một vòng, từ 10 viên hai vòng đồng tâm. Tính sẵn một lần.
 */
const PILES = Array.from({ length: MAX_DRAWN + 1 }, (_, n) => {
  if (n <= 5) return ring(n, ringR(n))
  if (n <= 9) return [[0, 0], ...ring(n - 1, Math.max(GAP, ringR(n - 1)))]
  const a = Math.round(n / 3)
  return [...ring(a, ringR(a)), ...ring(n - a, Math.max(ringR(a) + GAP, ringR(n - a)))]
})
// Hạt vàng li ti dát trên mặt bàn — vị trí cố định (không ngẫu nhiên mỗi lần vẽ).
const FLECKS = Array.from({ length: 26 }, (_, j) => {
  const r = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x) }
  return { x: 14 + r(j * 3 + 1) * (W - 28), y: BAND + 8 + r(j * 7 + 2) * (C * 2 + PAD * 2 - 16), s: 0.6 + r(j) * 1.1, o: 0.35 + r(j * 5) * 0.5 }
})
// Hạt bung ra khi ăn quân: 22 hướng, quãng bay khác nhau.
const SPARKS = Array.from({ length: 22 }, (_, j) => {
  const a = (j / 22) * Math.PI * 2 + (j % 3) * 0.17
  const d = 46 + ((j * 37) % 50)
  return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, s: 2.6 + (j % 4), hi: j % 3 === 0 }
})
const FX = { transformBox: 'fill-box', transformOrigin: 'center' }
const GLIDE = 'transform var(--dur-base) var(--ease-standard)'

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
  // key theo ply: mỗi nước mới dựng lại Board → bộ đếm khung bắt đầu từ 0, ô đang chọn tự bỏ.
  // Còn nước chờ diễn thì chưa cho đi (bàn đang hiện thế cũ).
  return (
    <Board key={shown.ply} {...props} state={shown} canMove={props.canMove && !more} more={more} onDone={done}
      animate={!still && shown.ply > mountPly} speed={still ? null : speed} onSpeed={pickSpeed} />
  )
}

function Board({ state, mySeat, canMove, onMove, animate, more, onDone, speed, onSpeed }) {
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
  const flip = mySeat === 1
  const at = (i) => slot(flip ? (i + 6) % 12 : i)
  const mine = mySeat == null ? [] : sideOf(mySeat)
  const live = canMove && !f
  const sel = live && mine.includes(picked) && state.stones[picked] > 0 ? picked : null
  const bottom = flip ? 1 : 0
  const taken = new Set(f ? [] : state.last?.taken || [])
  const refilled = f?.kind === 'refill' ? new Set(sideOf(f.at)) : null
  // Điểm vừa ăn ở khung 'eat' = điểm người đi tăng so với khung trước.
  const mover = state.last?.seat
  const gained = f?.kind === 'eat' && mover != null ? f.score[mover] - (k > 0 ? frames[k - 1].score[mover] : f.score[mover]) : 0

  const go = (dir) => {
    if (sel == null) return
    setPicked(null)
    onMove({ cell: sel, dir })
  }

  return (
    <div style={{ ...S.room, padding: isMobile ? '12px 10px 14px' : '18px 24px 22px' }}>
      <div style={{ display: 'grid', gap: 2, justifyItems: 'center', textAlign: 'center' }}>
        <span style={S.title}>{t('games.oanquan.name')}</span>
        <span style={S.sub}>{t('games.oanquan.lacquerSub')}</span>
      </div>

      <svg
        data-game-fx
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-label={t('games.oanquan.boardAria')}
        onClick={f ? () => setK(null) : undefined}
        style={{ width: '100%', maxWidth: 760, display: 'block', margin: '0 auto', touchAction: 'manipulation', userSelect: 'none', cursor: f ? 'pointer' : 'default', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={id('lac')} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={L.lac[0]} /><stop offset=".55" stopColor={L.lac[1]} /><stop offset="1" stopColor={L.lac[2]} />
          </linearGradient>
          <radialGradient id={id('pit')} cx=".5" cy=".42" r=".6">
            <stop offset="0" stopColor={L.pit[0]} /><stop offset=".72" stopColor={L.pit[1]} />
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

        {/* Mặt bàn: viền vàng dày, một vòng tối, rồi một chỉ vàng mảnh bên trong. */}
        <rect x={1.5} y={BAND + 1.5} width={W - 3} height={C * 2 + PAD * 2 - 3} rx={30} fill={`url(#${id('lac')})`} stroke={L.rim} strokeWidth={3} />
        <rect x={7} y={BAND + 7} width={W - 14} height={C * 2 + PAD * 2 - 14} rx={25} fill="none" stroke={L.rimIn} strokeWidth={6} />
        <rect x={10.5} y={BAND + 10.5} width={W - 21} height={C * 2 + PAD * 2 - 21} rx={22} fill="none" stroke={L.goldA(0.45)} />
        {FLECKS.map((p, j) => <circle key={j} cx={p.x} cy={p.y} r={p.s} fill={L.goldHi} opacity={p.o} />)}
        <line x1={PAD + C} y1={MID} x2={PAD + C * 6} y2={MID} stroke={L.goldA(0.35)} strokeDasharray="3 5" />

        {[1 - bottom, bottom].map((seat, row) => {
          const on = view.turn === seat && !view.over
          return (
            <text key={seat} x={W / 2} y={row ? H - 8 : 20} textAnchor="middle" fontSize={15}
              fill={on ? L.gold : L.muted} fontWeight={on ? 700 : 400} style={{ fontFamily: 'var(--font-display)' }}>
              <tspan>{t('games.oanquan.mark' + seat)}</tspan>
              <tspan dx={8} style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{view.score[seat]}</tspan>
              <tspan dx={4}>{t('games.oanquan.points')}</tspan>
            </text>
          )
        })}

        {view.stones.map((n, i) => {
          const b = at(i)
          const { cx, cy } = centerOf(b)
          const hasQuan = view.quan[i]
          const non = isQuanNon(view, i)
          const tap = live && mine.includes(i) && n > 0
          const hot = f && f.at === i
          const on = sel === i || hot
          const stroke = on ? L.gold : tap ? L.goldA(0.75) : L.goldA(0.45)
          // Đống sỏi: ô dân lùi 5 về phía đường giữa nhường chỗ cho con số ở mép ngoài; ô quan nằm dưới viên quan.
          const py = b.quan ? (hasQuan ? cy + 22 : cy) : cy + (b.top ? 5 : -5)
          const numY = b.quan ? cy + 64 : b.top ? b.y + 16 : b.y + b.h - 6
          const spots = PILES[Math.min(n, MAX_DRAWN)]
          const shape = (props) => (b.quan ? <path d={quanPath(b)} {...props} /> : <circle cx={cx} cy={cy} r={DAN_R} {...props} />)
          return (
            <g key={i} onClick={tap ? () => setPicked(picked === i ? null : i) : undefined}
              role={tap ? 'button' : undefined} aria-label={tap ? t('games.oanquan.cellAria', { n }) : undefined}
              style={{ cursor: tap ? 'pointer' : undefined }}>
              {on && shape({ fill: 'none', stroke: L.goldA(0.25), strokeWidth: 9 })}
              {shape({ fill: `url(#${id('pit')})`, stroke, strokeWidth: on ? 2.4 : 1.5, strokeDasharray: !f && state.last?.cell === i ? '6 4' : undefined })}
              {/* Bóng tối phía trên lòng ô cho cảm giác khoét sâu. */}
              {shape({ fill: 'none', stroke: L.shade, strokeWidth: 5, opacity: 0.6, pointerEvents: 'none' })}
              {taken.has(i) && shape({ fill: L.goldA(0.16), pointerEvents: 'none' })}
              {refilled?.has(i) && shape({ fill: L.goldA(0.22), pointerEvents: 'none' })}

              {hasQuan && (
                <g opacity={non ? 0.55 : 1}>
                  <ellipse cx={cx + 1} cy={cy - 30} rx={19} ry={16} fill={L.shade} />
                  <path d={`M${cx - 18} ${cy - 36} C${cx - 18} ${cy - 52} ${cx + 16} ${cy - 54} ${cx + 18} ${cy - 37} C${cx + 20} ${cy - 22} ${cx - 16} ${cy - 18} ${cx - 18} ${cy - 36} Z`}
                    fill={`url(#${id('jade')})`} />
                  <ellipse cx={cx - 6} cy={cy - 44} rx={5} ry={3} fill="#fff" opacity={0.45} />
                  {non && <ellipse cx={cx} cy={cy - 36} rx={25} ry={22} fill="none" stroke={L.gold} strokeDasharray="3 4" />}
                </g>
              )}
              {/* Viên cũ trượt về chỗ mới khi ô thêm sỏi; chỉ viên VỪA RƠI (hoặc vừa rải lại) mới hiện dần. */}
              {spots.map(([dx, dy], s) => (
                <g key={s} style={{ transform: `translate(${cx + dx}px, ${py + dy}px)`, transition: GLIDE }}>
                  <g style={refilled?.has(i) || (hot && f.kind === 'drop' && s === spots.length - 1) ? { ...FX, animation: 'gamePop var(--dur-base) var(--ease-standard) both' } : undefined}>
                    <ellipse cx={0.6} cy={1.4} rx={5.8} ry={5} fill={L.shade} />
                    <ellipse rx={5.8} ry={5.2} fill={L.stones[(i * 5 + s) % L.stones.length]} />
                    <ellipse cx={-1.8} cy={-1.9} rx={2.2} ry={1.4} fill="#fff" opacity={0.45} />
                  </g>
                </g>
              ))}

              {(n > 0 || hasQuan) && (
                <text x={cx} y={numY} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={L.gold} style={{ fontFamily: 'var(--font-mono)' }}>{n}</text>
              )}
              {non && (
                <text x={cx} y={cy - 2} textAnchor="middle" fontSize={10} fill={L.muted}>{t('games.oanquan.young')}</text>
              )}
            </g>
          )
        })}

        {/* Hiệu ứng của khung đang diễn: gợn sóng vàng khi bốc / rơi, ăn quân thì bung hạt + "+N". */}
        {f && (() => {
          const { cx, cy } = centerOf(at(f.at))
          if (f.kind === 'eat') {
            return (
              <g key={'fx' + k} pointerEvents="none">
                <circle cx={cx} cy={cy} r={58} fill="none" stroke={L.gold} strokeWidth={3} style={{ ...FX, animation: 'oaqRipple 1.1s ease-out both' }} />
                {SPARKS.map((p, j) => (
                  <rect key={j} x={cx - p.s / 2} y={cy - p.s / 2} width={p.s} height={p.s} rx={0.6} fill={p.hi ? '#fff1c2' : L.gold}
                    style={{ ...FX, '--dx': p.dx + 'px', '--dy': p.dy + 'px', animation: `oaqBurst ${1 + (j % 5) * 0.1}s cubic-bezier(.15,.7,.3,1) both` }} />
                ))}
                {gained > 0 && (
                  <text x={cx} y={cy} textAnchor="middle" fontSize={30} fontWeight={800} fill={L.goldHi} stroke={L.lac[1]} strokeWidth={3} paintOrder="stroke"
                    style={{ ...FX, fontFamily: 'var(--font-display)', animation: 'oaqFloat 1.4s ease-out both' }}>+{gained}</text>
                )}
              </g>
            )
          }
          return (
            <circle key={'fx' + k} cx={cx} cy={cy} r={f.kind === 'pick' ? 44 : 38} fill="none" stroke={L.gold} strokeWidth={2}
              pointerEvents="none" style={{ ...FX, animation: 'oaqRipple .9s ease-out both' }} />
          )
        })()}

        {/* Quả cầu vàng = nắm sỏi đang cầm, trượt theo ô đang rải; số trên đầu là số viên còn trong tay. */}
        {f && f.hand > 0 && (() => {
          const b = at(f.at)
          const x = centerOf(b).cx
          const y = b.quan ? b.y + 22 : MID + (b.top ? -10 : 10)
          return (
            <g pointerEvents="none" style={{ transform: `translate(${x}px, ${y}px)`, transition: 'transform 200ms cubic-bezier(.4,0,.2,1)' }}>
              <circle r={22} fill={`url(#${id('halo')})`} />
              <circle r={11} fill={`url(#${id('orb')})`} />
              <rect x={-13} y={-31} width={26} height={15} rx={7.5} fill="rgba(0,0,0,.75)" />
              <text y={-20} textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff" style={{ fontFamily: 'var(--font-mono)' }}>×{f.hand}</text>
            </g>
          )
        })()}

        {sel != null && (() => {
          const b = at(sel)
          const { cx, cy } = centerOf(b)
          return (
            <g>
              {[-1, 1].map((dir) => {
                const x = cx + dir * 30
                return (
                  <g key={dir} onClick={(e) => { e.stopPropagation(); go(dir) }} style={{ cursor: 'pointer' }} role="button"
                    aria-label={t(dir === 1 ? 'games.oanquan.sowRight' : 'games.oanquan.sowLeft')}>
                    <circle cx={x} cy={cy + 2} r={19} fill={L.shade} />
                    <circle cx={x} cy={cy} r={19} fill={`url(#${id('gold')})`} />
                    <path d={`M${x - dir * 5} ${cy - 7} L${x + dir * 5} ${cy} L${x - dir * 5} ${cy + 7}`}
                      fill="none" stroke={L.ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                )
              })}
            </g>
          )
        })()}
      </svg>

      {(canMove || f) && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', minHeight: isMobile ? 48 : 40 }}>
          {f
            ? <span style={S.hint}>{t('games.oanquan.skipHint')}</span>
            : sel == null
              ? <span style={S.hint}>{t('games.oanquan.pickHint')}</span>
              : (
                <>
                  <button type="button" style={S.goldBtn(false, isMobile)} onClick={() => go(-1)}>← {t('games.oanquan.sowLeft')}</button>
                  <button type="button" style={S.goldBtn(true, isMobile)} onClick={() => go(1)}>{t('games.oanquan.sowRight')} →</button>
                </>
              )}
        </div>
      )}

      {/* Tốc độ diễn lại — hàng riêng để không xô lệch hàng nút rải. Máy bật "giảm chuyển động" (không diễn) thì ẩn. */}
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
  room: { display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)', borderRadius: 20, background: L.room, border: '1px solid ' + L.roomEdge, minWidth: 0 },
  title: { font: '800 26px/1 var(--font-display)', color: L.gold, letterSpacing: '.01em' },
  sub: { font: '400 12.5px/1.3 var(--font-sans)', color: L.muted, opacity: 0.85 },
  hint: { font: 'var(--type-caption)', color: L.muted, textAlign: 'center' },
  goldBtn: (main, touch) => ({
    padding: touch ? '12px 18px' : '9px 16px', borderRadius: 12, cursor: 'pointer', font: '700 13.5px/1 var(--font-sans)', whiteSpace: 'nowrap',
    background: main ? `linear-gradient(180deg, ${L.goldHi}, ${L.rim})` : 'transparent', color: main ? L.ink : L.gold,
    border: '1px solid ' + (main ? L.rim : L.goldA(0.55)),
  }),
  speed: (on) => ({
    padding: '6px 12px', borderRadius: 99, cursor: 'pointer', font: '700 12.5px/1 var(--font-mono)',
    background: on ? L.goldA(0.16) : 'transparent', color: on ? L.gold : L.muted, border: '1px solid ' + (on ? L.goldA(0.6) : L.goldA(0.2)),
  }),
}
