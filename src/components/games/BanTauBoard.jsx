import { useEffect, useState } from 'react'
import { Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { t } from '#i18n'
import { G, btn, card, mono, over } from '#components/games/stage.js'
import { SkinPicker } from '#components/games/ChessStage.jsx'
import { useSkin } from '#components/games/chessSkins.js'
import { useFit } from '#components/games/chessUi.js'
import { CELLS, randomFleet, SHIPS, SIZE } from '#lib/games/bantau.js'

// Bàn Bắn tàu theo bản thiết kế "Bắn tàu" (2026-11-12): vùng biển 3 skin (Hải chiến / Radar / Giấy kẻ ô — chessSkins.js,
// nhớ theo máy), tàu vẽ chi tiết 5 loại, hiệu ứng khoá mục tiêu → đạn rơi → nổ (chớp, khói, vòng loang, mảnh bung, chữ
// Trúng / Chìm, biển rung) hoặc trượt (bọt nước), lửa cháy ở ô trúng, bảng Khai hoả / Lượt của bạn, bảng thắng.
// Hai bố cục theo bề rộng khung (không theo màn hình — phòng máy hẹp hơn phòng thật):
//   rộng ≥ WIDE: biển đối phương to + biển mình nhỏ + hạm đội hai bên, bấm ô là bắn;
//   hẹp: một biển + tab Bên kia / Bên mình (tự đổi theo lượt), chạm ô để chọn rồi bấm Bắn.
// Hiệu ứng suy từ state.last, key theo số nước — không giữ state; vào phòng giữa chừng không diễn lại nước cũ (mountPly).
// Bọc `data-game-fx` nên máy bật "giảm chuyển động" là tắt hết. Luật: lib/games/bantau.js.
// Tàu cất ở server (game_hands, chỉ chủ tàu đọc); chơi với máy (BotRoom) truyền sẵn `hands` — khỏi hỏi server.
// ponytail: chỉ xếp ngẫu nhiên, chưa kéo thả từng tàu — thêm khi người chơi cần.

const WIDE = 800
const SHELL = 750 // ms từ lúc khoá mục tiêu tới lúc đạn chạm biển
const FILES = 'ABCDEFGHIJ'
const ME = '#00B2A9' // nhấn phía mình / phía đối phương (bản thiết kế)
const FOE = '#ff7a1a'
const cellName = (i) => FILES[i % SIZE] + (Math.floor(i / SIZE) + 1)
const offsets = SHIPS.map((_, k) => SHIPS.slice(0, k).reduce((a, b) => a + b, 0))
const cut = (cells) => SHIPS.map((n, k) => cells.slice(offsets[k], offsets[k] + n))
// Mảnh bung: 10 hướng (em), như bản thiết kế.
const PARTS = [[1, -0.25], [0.809, 0.338], [0.309, 0.701], [-0.309, 0.701], [-0.809, 0.338], [-1, -0.25], [-0.809, -0.838], [-0.309, -1.201], [0.309, -1.201], [0.809, -0.838]]
const FIRE = ['#fff3b0', '#ffb24a', '#ff6a2b', '#ff3b2b']

/** Hình tàu theo loại (0 tàu sân bay · 1 thiết giáp · 2 tuần dương · 3 tàu ngầm · 4 khu trục), khung ngang dài × 40. */
function Hull({ art, c }) {
  const p = { fill: c.hull, stroke: c.stroke, strokeWidth: 1.6 }
  const d = { fill: c.deck, stroke: c.stroke, strokeWidth: 1.2 }
  const gun = (x, flip) => (
    <g key={x}>
      <circle cx={x} cy={20} r={5.2} {...d} />
      <path d={`M${x} 18.2 L${x + (flip ? -11 : 11)} 18.2 M${x} 21.8 L${x + (flip ? -11 : 11)} 21.8`} stroke={c.det} strokeWidth={1.6} strokeLinecap="round" />
    </g>
  )
  const bridge = (x, w, h) => (
    <g>
      <rect x={x} y={20 - h / 2} width={w} height={h} rx={2.5} {...d} />
      <rect x={x + w * 0.55} y={22 - h / 2} width={w * 0.3} height={h - 4} rx={1} fill={c.det} />
    </g>
  )
  const bow = (n) => `M5 13 L${n} 7 Q${n + 18} 9 ${n + 24} 20 Q${n + 18} 31 ${n} 33 L5 27 Q2 20 5 13 Z`
  if (art === 0) {
    return (
      <>
        <path d={bow(174)} {...p} />
        <rect x={14} y={10.5} width={160} height={19} rx={3} {...d} strokeWidth={1} />
        <path d="M22 20 L166 20" stroke={c.det} strokeWidth={1.4} strokeDasharray="7 6" />
        <path d="M30 13 L70 18" stroke={c.det} strokeWidth={1} opacity={0.6} />
        <rect x={116} y={3.5} width={24} height={8} rx={2} {...d} />
        <rect x={128} y={5} width={7} height={5} rx={1} fill={c.det} />
        <path d="M40 27 l8 0 M60 27 l8 0" stroke={c.det} strokeWidth={1.4} />
      </>
    )
  }
  if (art === 1) return <><path d={bow(134)} {...p} />{gun(24)}{gun(44)}{bridge(64, 22, 13)}{gun(112, true)}{gun(132, true)}</>
  if (art === 2) return <><path d={bow(94)} {...p} />{gun(22)}{bridge(44, 20, 12)}{gun(92, true)}</>
  if (art === 3) {
    return (
      <>
        <path d="M6 20 C6 11 14 9 24 9 L98 9 C112 9 117 14 117 20 C117 26 112 31 98 31 L24 31 C14 31 6 29 6 20 Z" {...p} />
        <rect x={52} y={14} width={22} height={12} rx={6} {...d} />
        <path d="M66 14 L66 8 L70 8" stroke={c.det} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        <path d="M14 20 L44 20 M84 20 L104 20" stroke={c.det} strokeWidth={1.2} strokeDasharray="3 3" />
      </>
    )
  }
  return <><path d={bow(54)} {...p} />{gun(20)}{bridge(36, 16, 11)}</>
}

/** Một con tàu đặt trên biển (toạ độ %), dựng dọc thì xoay. */
function Ship({ cells, art, K, sunk, appear }) {
  const cs = [...cells].sort((a, b) => a - b)
  const n = cs.length
  const down = n > 1 && cs[1] - cs[0] === SIZE
  const r = Math.floor(cs[0] / SIZE)
  const c = cs[0] % SIZE
  return (
    <svg aria-hidden="true" viewBox={down ? `0 0 40 ${n * 40}` : `0 0 ${n * 40} 40`} preserveAspectRatio="none"
      style={{
        position: 'absolute', left: c * 10 + '%', top: r * 10 + '%', width: (down ? 1 : n) * 10 + '%', height: (down ? n : 1) * 10 + '%',
        padding: '0.3cqw', overflow: 'visible', boxSizing: 'border-box',
        filter: sunk && !K.paper ? 'grayscale(.75) brightness(.55) sepia(.3)' : 'none', opacity: sunk && K.paper ? 0.55 : 1,
        animation: appear ? `btDrop .5s ease-out ${appear}ms both` : undefined,
      }}>
      <g transform={down ? 'translate(40 0) rotate(90)' : undefined}><Hull art={art} c={K} /></g>
    </svg>
  )
}

/** Dấu trên một ô: trượt (vòng), trúng (lửa cháy — skin giấy: dấu X), tàu chìm (ô đỏ nhạt). `delay` = ô vừa bắn. */
function Mark({ v, K, delay }) {
  const appear = delay != null ? { animation: `btDrop .35s ease-out ${delay}ms both` } : undefined
  if (v === 'miss') {
    return <span aria-hidden="true" style={{ position: 'absolute', inset: '27%', borderRadius: '50%', border: '2px solid ' + K.miss, background: K.missBg, ...appear }} />
  }
  if (K.paper) {
    return (
      <span aria-hidden="true" style={{
        position: 'absolute', inset: '18%', ...appear,
        background: 'linear-gradient(45deg,transparent 43%,#d5283c 43% 57%,transparent 57%),linear-gradient(-45deg,transparent 43%,#d5283c 43% 57%,transparent 57%)',
      }} />
    )
  }
  return (
    <span aria-hidden="true" style={{ position: 'absolute', inset: 0, ...appear }}>
      <span style={{
        position: 'absolute', left: '50%', top: '50%', width: '64%', height: '64%', transform: 'translate(-50%,-50%)', borderRadius: '50%',
        background: 'radial-gradient(circle,rgba(255,240,170,.95) 0 18%,rgba(255,150,40,.9) 38%,rgba(230,60,20,.55) 62%,transparent 72%)',
        animation: 'btFlicker .5s ease-in-out infinite alternate',
      }} />
      <span style={{
        position: 'absolute', left: '50%', top: '22%', width: '30%', height: '44%', transform: 'translateX(-50%)', borderRadius: '50% 50% 40% 40%',
        background: 'radial-gradient(circle at 50% 70%,#fff4b8,#ffb43a 45%,rgba(255,80,20,0) 75%)', animation: 'btFlame .35s ease-in-out infinite alternate',
      }} />
    </span>
  )
}

/** Chỗ giữa ô `i` (toạ độ % trên biển). */
const at = (i) => ({ left: ((i % SIZE) + 0.5) * 10 + '%', top: (Math.floor(i / SIZE) + 0.5) * 10 + '%' })

/** Khoá mục tiêu + đạn rơi xuống ô (`wait` = đang chờ server: chỉ vòng ngắm nhấp nháy). */
function Aim({ cell, wait }) {
  const ring = {
    position: 'absolute', ...at(cell), width: '19cqw', height: '19cqw', borderRadius: '50%', border: '2px solid #ff5a3c', zIndex: 20,
    background: 'linear-gradient(#ff5a3c,#ff5a3c) 50% 0/2px 26% no-repeat,linear-gradient(#ff5a3c,#ff5a3c) 50% 100%/2px 26% no-repeat,linear-gradient(90deg,#ff5a3c,#ff5a3c) 0 50%/26% 2px no-repeat,linear-gradient(90deg,#ff5a3c,#ff5a3c) 100% 50%/26% 2px no-repeat',
    animation: wait ? 'btLockWait .8s ease-in-out infinite' : `btLock ${SHELL}ms ease-out both`, transform: 'translate(-50%,-50%)',
  }
  return (
    <>
      <span aria-hidden="true" style={ring} />
      {!wait && (
        <span aria-hidden="true" style={{
          position: 'absolute', ...at(cell), width: '2.2cqw', height: '5.9cqw', borderRadius: '50% 50% 30% 30%', zIndex: 21, opacity: 0,
          background: 'linear-gradient(#fff,#ffcf6a 40%,#ff7a1a)', boxShadow: '0 0 10px #ffb24a', animation: `btShell ${SHELL}ms cubic-bezier(.5,0,.9,.6) both`,
        }} />
      )}
    </>
  )
}

/** Nổ / bọt nước tại ô vừa bắn, chạy sau khi đạn chạm biển. kind: 'boom' | 'splash'; big = tàu chìm. */
function Blast({ cell, kind, big, text }) {
  const splash = kind === 'splash'
  const k = big ? 3.2 : splash ? 1.3 : 2
  const go = (name, s, ease = 'ease-out', extra = 0) => `${name} ${s}s ${ease} ${SHELL / 1000 + extra}s both`
  const ringC = splash ? 'rgba(220,240,255,.95)' : '#ffb24a'
  const abs = { position: 'absolute', opacity: 0 }
  return (
    <span aria-hidden="true" style={{ position: 'absolute', ...at(cell), width: 0, height: 0, fontSize: `calc(10cqw * ${k})`, pointerEvents: 'none', zIndex: 30 }}>
      {!splash && (
        <>
          <span style={{ ...abs, left: '-1em', top: '-1em', width: '2em', height: '2em', borderRadius: '50%', animation: go('btFlash', 0.45),
            background: 'radial-gradient(circle,#fff 0,#ffe08a 25%,rgba(255,120,30,.6) 50%,transparent 70%)' }} />
          <span style={{ ...abs, left: '-.6em', top: '-.6em', width: '1.2em', height: '1.2em', borderRadius: '50%', animation: go('btSmoke', 1.4),
            background: 'radial-gradient(circle,rgba(70,70,80,.75),rgba(40,40,50,0) 70%)' }} />
        </>
      )}
      <span style={{ ...abs, left: 0, top: 0, width: '2em', height: '2em', borderRadius: '50%', border: '3px solid ' + ringC, animation: go(big ? 'btRingBig' : 'btRing', big ? 0.9 : 0.6) }} />
      {splash && <span style={{ ...abs, left: 0, top: 0, width: '2em', height: '2em', borderRadius: '50%', border: '2px solid ' + ringC, animation: go('btRing', 0.9, 'ease-out', 0.15) }} />}
      {PARTS.map(([dx, dy], i) => (
        <span key={i} style={{
          ...abs, left: -4, top: -4, width: splash ? 6 : 9, height: splash ? 6 : 9, borderRadius: '50%', '--dx': dx + 'em', '--dy': dy + 'em',
          background: splash ? (i % 2 ? '#e6f6ff' : '#8fd3ff') : FIRE[i % 4], boxShadow: `0 0 6px ${splash ? '#8fd3ff' : FIRE[i % 4]}`,
          animation: go('btPart', splash ? 0.55 : 0.8, 'cubic-bezier(.2,.7,.3,1)'),
        }} />
      ))}
      <span style={{
        ...abs, left: 0, top: 0, padding: '4px 10px', borderRadius: 99, whiteSpace: 'nowrap', boxShadow: '0 6px 16px rgba(0,0,0,.4)',
        font: `800 ${big ? 16 : 12}px/1.2 var(--font-display)`, color: '#fff', background: splash ? 'rgba(20,40,70,.85)' : big ? '#e53935' : FOE,
        animation: go('btText', 1.2),
      }}>{text}</span>
    </span>
  )
}

/** Bảng chữ giữa biển: Khai hoả! / Lượt của bạn. */
function Banner({ text, delay = 0 }) {
  return (
    <span aria-hidden="true" style={{
      position: 'absolute', left: '50%', top: '50%', zIndex: 35, padding: '8px 18px', borderRadius: 99, whiteSpace: 'nowrap', opacity: 0,
      background: ME, color: '#04302C', font: '800 18px/1.2 var(--font-display)', boxShadow: '0 6px 16px rgba(0,0,0,.4)',
      animation: `btBanner 1.5s ease-out ${delay}ms both`,
    }}>{text}</span>
  )
}

/**
 * Một vùng biển có dải toạ độ. `cells` = dấu từng ô; `onCell(i)` (có thì ô bấm được); `sel` ô đang chọn; `glow` màu viền
 * khi tới lượt; `shake` số phát trúng (đổi chẵn / lẻ để rung lại); `fx` = { ply, cell, kind, big, text } phát vừa bắn;
 * `aim` = { cell, wait }; `banner` = { key, text, delay }.
 */
function Sea({ K, size, label, ships, cells, hot, onCell, sel, glow, shake, fx, aim, banner, aria }) {
  const lab = Math.max(14, Math.round(size / 20))
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `${lab}px minmax(0, 1fr)`, gridTemplateRows: `${lab}px auto`, width: '100%', maxWidth: size + lab, justifySelf: 'center' }}>
      <span />
      <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', font: `600 ${Math.max(9, lab - 9)}px/1 var(--font-mono)`, color: K.lab }}>
        {[...FILES].map((f) => <span key={f} style={{ flex: 1, textAlign: 'center' }}>{f}</span>)}
      </div>
      <div aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', font: `600 ${Math.max(9, lab - 9)}px/1 var(--font-mono)`, color: K.lab }}>
        {Array.from({ length: SIZE }, (_, k) => <span key={k} style={{ flex: 1, display: 'grid', placeItems: 'center' }}>{k + 1}</span>)}
      </div>
      <div data-game-fx role={onCell ? 'grid' : 'img'} aria-label={aria} style={{
        position: 'relative', aspectRatio: '1', containerType: 'inline-size', borderRadius: Math.round(size / 35), overflow: 'hidden', background: K.sea,
        boxShadow: glow ? `0 0 0 2px ${glow},0 0 34px -6px ${glow}` : '0 0 0 1px ' + K.frame, transition: 'box-shadow .3s',
        animation: shake ? `${shake % 2 ? 'btShakeA' : 'btShakeB'} .4s ease-in-out ${SHELL}ms` : undefined,
      }}>
        {K.wave && (
          <span aria-hidden="true" style={{
            position: 'absolute', inset: '-20%', animation: 'btWave 9s linear infinite',
            background: 'repeating-radial-gradient(ellipse 60px 18px at 30% 40%,rgba(255,255,255,.07) 0 2px,transparent 3px 22px),repeating-linear-gradient(115deg,rgba(255,255,255,.035) 0 10px,transparent 10px 34px)',
          }} />
        )}
        {K.sweep && (
          <>
            <span aria-hidden="true" style={{
              position: 'absolute', left: '-25%', top: '-25%', width: '150%', height: '150%', borderRadius: '50%', animation: 'btSweep 4s linear infinite',
              background: 'conic-gradient(from 0deg,rgba(93,255,176,.38),rgba(93,255,176,0) 60deg,transparent 360deg)',
            }} />
            <span aria-hidden="true" style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(circle,transparent 0 19%,rgba(93,255,176,.22) 19.4% 20%,transparent 20.4% 39%,rgba(93,255,176,.22) 39.4% 40%,transparent 40.4% 59%,rgba(93,255,176,.18) 59.4% 60%,transparent 60.4%)',
            }} />
          </>
        )}
        <span aria-hidden="true" style={{ position: 'absolute', inset: 0, backgroundImage: `linear-gradient(${K.grid} 1px,transparent 1px),linear-gradient(90deg,${K.grid} 1px,transparent 1px)`, backgroundSize: '10% 10%' }} />
        {ships.map((s, k) => <Ship key={k} K={K} {...s} />)}
        <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${SIZE}, minmax(0, 1fr))` }}>
          {cells.map((v, i) => {
            const can = onCell && v == null
            const Tag = onCell ? 'button' : 'span'
            const sunkBg = v === 'sunk' ? (K.paper ? 'rgba(200,40,60,.12)' : 'rgba(255,90,40,.22)') : 'transparent'
            return (
              <Tag key={i} {...(onCell ? { type: 'button', disabled: !can, onClick: () => onCell(i), 'aria-label': t('games.bantau.fireAria', { cell: cellName(i) }), className: 'bt-cell' } : {})}
                style={{ position: 'relative', padding: 0, border: 0, font: 'inherit', background: sunkBg, cursor: can ? 'crosshair' : 'default', minWidth: 0 }}>
                {v && <Mark v={v} K={K} delay={i === hot ? SHELL : null} />}
                {sel === i && (
                  <span aria-hidden="true" style={{
                    position: 'absolute', inset: '6%', borderRadius: '22%', border: '2.5px solid #ffcf4a',
                    boxShadow: '0 0 12px #ffcf4a,inset 0 0 8px rgba(255,207,74,.5)', animation: 'btSel 1s ease-in-out infinite',
                  }} />
                )}
              </Tag>
            )
          })}
        </div>
        {aim && <Aim key={aim.key} cell={aim.cell} wait={aim.wait} />}
        {fx && <Blast key={fx.ply} {...fx} />}
        {banner && <Banner key={banner.key} text={banner.text} delay={banner.delay} />}
        {label}
      </div>
    </div>
  )
}

/** Hạm đội một bên: tên tàu, số ô, các đốt đỏ = đã trúng; tàu chìm gạch ngang. */
function Fleet({ title, note, rows, chips }) {
  if (chips) {
    return (
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
        {rows.map((r, k) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px', borderRadius: 99, background: G.card, border: '1px solid ' + G.line, opacity: r.sunk ? 0.5 : 1 }}>
            <span style={{ display: 'flex', gap: 2 }}>{r.segs.map((h, j) => <span key={j} style={{ width: 6, height: 6, borderRadius: 1, background: h ? '#e5533a' : G.lineHi }} />)}</span>
            <span style={{ ...mono, fontSize: 11, textDecoration: r.sunk ? 'line-through' : 'none' }}>{t('games.bantau.cells', { n: r.segs.length })}</span>
          </span>
        ))}
      </div>
    )
  }
  return (
    <div style={{ ...card, padding: '12px 14px', display: 'grid', gap: 8, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={over}>{title}</span>
        <span style={{ ...mono, color: G.soft }}>{note}</span>
      </div>
      {rows.map((r, k) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: r.sunk ? 0.5 : 1, minWidth: 0 }}>
          <span style={{ flex: 1, minWidth: 0, font: '400 13px/1.3 var(--font-sans)', textDecoration: r.sunk ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t('games.bantau.ship.' + k)} <span style={{ ...mono, fontSize: 11 }}>{t('games.bantau.cells', { n: r.segs.length })}</span>
          </span>
          <span style={{ flex: 'none', display: 'flex', gap: 3 }}>
            {r.segs.map((h, j) => <span key={j} style={{ width: 12, height: 8, borderRadius: 2, background: h ? '#e5533a' : G.lineHi }} />)}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Vòng tròn chữ đầu tên, viền theo phe. */
const Face = ({ name, ring, size = 36 }) => (
  <span aria-hidden="true" style={{
    width: size, height: size, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff',
    background: ring === ME ? '#3b7a7a' : '#5b6fd6', boxShadow: '0 0 0 3px ' + ring, font: `700 ${Math.round(size * 0.4)}px/1 var(--font-sans)`,
  }}>{(name || '?').trim().charAt(0).toUpperCase()}</span>
)

export default function BanTauBoard({ state, mySeat, canMove, onMove, roomId, result, hands: given, names }) {
  const { a } = useApp()
  const [, K] = useSkin('bantau')
  const [box, fit] = useFit(WIDE)
  const wide = fit >= 1
  const [draft, setDraft] = useState(() => randomFleet())
  const [hands, setHands] = useState(null) // { roomId, hands } — tàu đã chốt (của mình; hết ván: cả hai)
  const [asked, setAsked] = useState({ ply: -1, cell: null }) // nước đang chờ server (chốt tàu / bắn) — khỏi bấm hai lần
  const [sel, setSel] = useState({ ply: -1, cell: null }) // bố cục hẹp: ô đang chọn, chưa bắn
  const [view, setView] = useState('foe') // bố cục hẹp: biển đang xem
  const [mountPly] = useState(state.ply) // nước trước lúc mở bàn thì không diễn hiệu ứng
  const seated = mySeat != null
  const placedMe = seated && state.placed[mySeat]
  const reveal = !!result
  useEffect(() => {
    if (given || !(placedMe || reveal)) return undefined
    let live = true
    a.gameHand(roomId).then((h) => { if (live) setHands({ roomId, hands: h }) }).catch((e) => console.warn('[games] Không nạp được tàu:', e?.message || e))
    return () => { live = false }
  }, [a, roomId, placedMe, reveal, given])

  const me = seated ? mySeat : 0
  const foe = 1 - me
  const fire = state.phase === 'fire'
  const over = state.over || !!result
  const myTurn = fire && !over && canMove
  // Bố cục hẹp: tới lượt ai thì hiện biển người đó đang bị bắn — đổi sau khi hiệu ứng phát vừa rồi chạy xong.
  useEffect(() => {
    if (wide || !fire || over) return undefined
    const want = state.turn === me ? 'foe' : 'me'
    const id = setTimeout(() => setView(want), state.ply > mountPly ? SHELL + 900 : 0)
    return () => clearTimeout(id)
  }, [wide, fire, over, state.turn, state.ply, me, mountPly])

  const fleetOf = (seat) => {
    const cells = given ? given[seat] : hands?.roomId === roomId ? hands.hands?.[seat] : null
    return cells?.length ? cut(cells) : null
  }
  const nameOf = (seat) => (seat === mySeat ? t('games.bantau.you') : names?.[seat] || t('games.bantau.mark' + seat))
  const wait = asked.ply === state.ply
  const send = (move, cell = null) => { setAsked({ ply: state.ply, cell }); setTimeout(() => setAsked({ ply: -1, cell: null }), 4000); onMove(move) }

  // Phát vừa bắn (chỉ nước mới từ lúc mở bàn) → hiệu ứng trên biển bị bắn.
  const last = state.last
  const fresh = state.ply > mountPly
  const shot = fresh && last?.fire != null ? last : null
  const fxOf = (target) => {
    if (!shot || 1 - shot.seat !== target) return null
    const big = !!shot.sunk
    const k = big ? sunkIndex(state.sunk[shot.seat], shot.sunk) : null
    const text = !shot.hit ? t('games.bantau.fxMiss') : big ? t('games.bantau.fxSunk', { ship: t('games.bantau.ship.' + k) }) : t('games.bantau.fxHit')
    return { ply: state.ply, cell: shot.fire, kind: shot.hit ? 'boom' : 'splash', big, text }
  }
  const hits = (seat) => state.shots[seat].filter((v) => v === 'hit' || v === 'sunk').length // phát trúng ghế đó bắn ra
  const banner = !seated || over ? null
    : fresh && last?.placed && fire ? { key: state.ply, text: t('games.bantau.bannerStart'), delay: 0 }
      : shot && !shot.hit && shot.seat === foe && state.turn === me ? { key: state.ply, text: t('games.bantau.bannerTurn'), delay: SHELL + 700 }
        : null

  // Tàu trên biển mình (đủ 5 chiếc, chiếc nào đã chìm thì xám) và biển đối phương (chỉ chiếc đã chìm; hết ván lật hết).
  const sunkCells = (list) => new Set(list.flat())
  const shipsOn = (seat) => {
    const own = fleetOf(seat)
    const sunkBy = state.sunk[1 - seat]
    const gone = sunkCells(sunkBy)
    const justSunk = shot && shot.sunk && 1 - shot.seat === seat ? new Set(shot.sunk) : null
    const appear = (cells) => (justSunk && cells.some((c) => justSunk.has(c)) ? SHELL : 0)
    if (own && (seat === mySeat || reveal)) {
      return own.map((cells, k) => ({ cells, art: k, sunk: cells.every((c) => gone.has(c)), appear: seat !== mySeat ? appear(cells) : 0 }))
    }
    return sunkBy.map((cells, j) => ({ cells, art: artOf(sunkBy, j), sunk: true, appear: appear(cells) }))
  }
  const fleetRows = (seat) => {
    const own = fleetOf(seat)
    const sunkBy = state.sunk[1 - seat]
    if (own && seat === mySeat) {
      const gone = sunkCells(sunkBy)
      return own.map((cells) => ({ segs: cells.map((c) => state.shots[1 - seat][c] != null), sunk: cells.every((c) => gone.has(c)) }))
    }
    // Đối phương: chỉ biết tàu nào đã chìm (theo độ dài; hai tàu 3 ô đếm lần lượt).
    const lens = sunkBy.map((s) => s.length)
    return SHIPS.map((n, k) => {
      const nth = SHIPS.slice(0, k).filter((x) => x === n).length
      const sunk = lens.filter((x) => x === n).length > nth
      return { segs: Array(n).fill(sunk), sunk }
    })
  }
  const left = (seat) => SHIPS.length - state.sunk[1 - seat].length

  // ---------- Xếp tàu ----------
  if (state.phase === 'place') {
    const mine = placedMe ? fleetOf(mySeat) : draft
    const foeReady = state.placed[foe]
    const sea = (
      <Sea K={K} size={wide ? 460 : 340} aria={t('games.bantau.yourSea')} cells={Array(CELLS).fill(null)}
        ships={(mine || []).map((cells, k) => ({ cells, art: k }))} />
    )
    return (
      <div ref={box} style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)', color: G.text }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><SkinPicker kind="bantau" /></div>
        <div style={{ display: 'grid', gap: 22, alignItems: 'start', gridTemplateColumns: wide ? 'minmax(0, 1fr) 300px' : 'minmax(0, 1fr)' }}>
          <div style={{ display: 'grid', gap: 14, justifyItems: 'center', gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ font: `800 ${wide ? 22 : 20}px/1.2 var(--font-display)` }}>{t(placedMe ? 'games.bantau.placedTitle' : 'games.bantau.placeTitle')}</div>
              <div style={{ font: '400 14px/1.4 var(--font-sans)', color: G.soft, marginTop: 4 }}>
                {seated && !placedMe ? t('games.bantau.placeHint') + ' ' : ''}
                {t(foeReady ? 'games.bantau.foeReady' : 'games.bantau.foePlacing', { name: nameOf(foe) })}
              </div>
            </div>
            {(seated || reveal) && sea}
            {seated && !placedMe && (
              <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 460, flexDirection: wide ? 'row' : 'column', justifyContent: 'center' }}>
                <button type="button" onClick={() => setDraft(randomFleet())} style={{ ...btn('ghost'), minHeight: 48, padding: '0 22px', flex: wide ? 'none' : undefined }}>
                  <Icon name="shuffle" size={16} />{t('games.bantau.shuffle')}
                </button>
                <button type="button" disabled={wait} onClick={() => send({ place: draft })} style={{ ...btn('primary'), minHeight: wide ? 48 : 56, padding: '0 26px', fontSize: 15, opacity: wait ? 0.6 : 1 }}>
                  {t('games.bantau.confirm')}
                </button>
              </div>
            )}
          </div>
          {wide && seated && <Fleet title={t('games.bantau.fleetMine')} note={t('games.bantau.cellsTotal', { n: SHIPS.reduce((x, y) => x + y, 0) })}
            rows={SHIPS.map((n) => ({ segs: Array(n).fill(false), sunk: false }))} />}
        </div>
      </div>
    )
  }

  // ---------- Bắn ----------
  const aimFoe = wait && asked.cell != null ? { key: 'w' + asked.cell, cell: asked.cell, wait: true }
    : shot && shot.seat === me ? { key: state.ply, cell: shot.fire } : null
  const aimMe = shot && shot.seat === foe ? { key: state.ply, cell: shot.fire } : null
  const pick = sel.ply === state.ply ? sel.cell : null
  const tap = (i) => {
    if (!myTurn || wait || state.shots[me][i] != null) return
    if (wide) send({ fire: i }, i)
    else setSel({ ply: state.ply, cell: i })
  }
  const hitsOn = (seat) => (shot && shot.hit && 1 - shot.seat === seat ? hits(shot.seat) : 0)
  const foeSea = (size) => (
    <Sea K={K} size={size} aria={t('games.bantau.seaOf', { side: nameOf(foe) })} cells={state.shots[me]} ships={shipsOn(foe)}
      hot={shot?.seat === me ? shot.fire : null} onCell={seated ? tap : null} sel={wide ? null : pick}
      glow={myTurn ? ME : null} shake={hitsOn(foe)} fx={fxOf(foe)} aim={aimFoe} banner={banner} />
  )
  const mySea = (size) => (
    <Sea K={K} size={size} aria={t('games.bantau.seaOf', { side: nameOf(me) })} cells={state.shots[foe]} ships={shipsOn(me)}
      hot={shot?.seat === foe ? shot.fire : null} glow={fire && !over && state.turn === foe ? FOE : null}
      shake={hitsOn(me)} fx={fxOf(me)} aim={aimMe} />
  )
  const winner = state.winner ?? result?.winners?.[0]
  const turnTxt = over
    ? (winner === mySeat ? t('games.bantau.overMe', { name: nameOf(foe) }) : seated ? t('games.bantau.overFoe', { name: nameOf(foe) }) : t('games.bantau.winOf', { name: nameOf(winner) }))
    : wait ? t('games.bantau.firing')
      : myTurn ? t(wide ? 'games.bantau.fireHint' : 'games.bantau.pickHint')
        : t('games.bantau.aiming', { name: nameOf(state.turn) })
  const lastTxt = last?.fire != null
    ? t(last.sunk ? 'games.bantau.lastSunk' : last.hit ? 'games.bantau.lastHit' : 'games.bantau.lastMiss', {
      side: nameOf(last.seat), cell: cellName(last.fire), n: last.sunk?.length,
    })
    : ''
  const win = over && winner != null && (
    <div data-game-fx role="status" style={{
      position: 'absolute', left: '50%', top: '50%', zIndex: 50, padding: '18px 28px', borderRadius: 16, textAlign: 'center',
      background: 'rgba(10,16,32,.94)', border: '2px solid ' + (winner === me ? ME : FOE), boxShadow: '0 0 50px ' + (winner === me ? ME : FOE),
      transform: 'translate(-50%,-50%)', animation: 'btWin .5s cubic-bezier(.2,1.4,.4,1) both',
    }}>
      <div style={{ font: '800 26px/1.2 var(--font-display)', color: '#fff', whiteSpace: 'nowrap' }}>
        {winner === mySeat ? t('games.bantau.winMe') : t('games.bantau.winOf', { name: nameOf(winner) })}
      </div>
    </div>
  )
  const head = (seat, sub, ring) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <Face name={nameOf(seat)} ring={ring} />
      <div style={{ minWidth: 0 }}>
        <div style={{ font: '700 15px/1.25 var(--font-sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {seat === mySeat ? t('games.bantau.yourSea') : t('games.bantau.seaOf', { side: nameOf(seat) })}
        </div>
        <div style={{ ...mono }}>{sub}</div>
      </div>
    </div>
  )

  if (wide) {
    return (
      <div ref={box} style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)', color: G.text }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div role="status" style={{ ...card, flex: 1, padding: '12px 16px', font: '600 15px/1.3 var(--font-sans)', textAlign: 'center', color: myTurn ? G.tealHi : over ? G.text : G.soft }}>{turnTxt}</div>
          <SkinPicker kind="bantau" />
        </div>
        <div style={{ position: 'relative', display: 'grid', gap: 26, alignItems: 'start', gridTemplateColumns: 'minmax(0, 460px) 300px', justifyContent: 'center' }}>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)' }}>
            {head(foe, t('games.bantau.sunkBy', { name: nameOf(me), n: state.sunk[me].length, total: SHIPS.length }), FOE)}
            {foeSea(460)}
          </div>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)' }}>
            {head(me, t('games.bantau.sunkBy', { name: nameOf(foe), n: state.sunk[foe].length, total: SHIPS.length }), ME)}
            {mySea(300)}
            <Fleet title={seated ? t('games.bantau.fleetMine') : t('games.bantau.fleetOf', { name: nameOf(me) })} note={t('games.bantau.left', { n: left(me) })} rows={fleetRows(me)} />
            <Fleet title={t('games.bantau.fleetOf', { name: nameOf(foe) })} note={t('games.bantau.left', { n: left(foe) })} rows={fleetRows(foe)} />
          </div>
          {win}
        </div>
        <div aria-live="polite" style={{ textAlign: 'center', font: 'var(--type-caption)', color: last?.hit ? 'var(--status-incident-fg)' : G.muted, minHeight: 18 }}>{lastTxt}</div>
      </div>
    )
  }

  // ---------- Bố cục hẹp (điện thoại, phòng máy) ----------
  const side = (seat, ring, alignEnd) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', flexDirection: alignEnd ? 'row-reverse' : 'row',
      background: fire && !over && state.turn === seat ? (seat === me ? 'rgba(0,178,169,.14)' : 'rgba(255,122,26,.14)') : 'transparent',
    }}>
      <Face name={nameOf(seat)} ring={ring} size={30} />
      <span style={{ flex: 1, minWidth: 0, font: '700 13.5px/1.2 var(--font-sans)', textAlign: alignEnd ? 'right' : 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameOf(seat)}</span>
      <span style={{ ...mono, fontWeight: 700, color: ring }}>{t('games.bantau.left', { n: left(seat) })}</span>
    </div>
  )
  const fireLabel = over ? '' : !myTurn ? t('games.bantau.aiming', { name: nameOf(state.turn) }) : wait ? t('games.bantau.firing')
    : pick != null ? t('games.bantau.fireAt', { cell: cellName(pick) }) : t('games.bantau.pickHint')
  const armed = myTurn && !wait && pick != null
  return (
    <div ref={box} style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)', color: G.text }}>
      <div style={{ ...card, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', overflow: 'hidden' }}>
        <div style={{ borderRight: '1px solid ' + G.line }}>{side(me, ME)}</div>
        {side(foe, FOE, true)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span role="status" style={{ font: '700 15px/1.3 var(--font-sans)', color: myTurn ? G.tealHi : over ? G.text : FOE, minWidth: 0 }}>{turnTxt}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div role="tablist" style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 99, background: G.card, border: '1px solid ' + G.line }}>
            {[['foe', t('games.bantau.tabFoe')], ['me', t('games.bantau.tabMe')]].map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)} style={{
                minHeight: 34, padding: '0 13px', borderRadius: 99, border: 0, cursor: 'pointer', font: '700 12.5px/1 var(--font-sans)',
                background: view === k ? G.text : 'transparent', color: view === k ? 'var(--surface-card)' : G.soft,
              }}>{l}</button>
            ))}
          </div>
          <SkinPicker kind="bantau" />
        </div>
      </div>
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }}>
        {view === 'foe' ? foeSea(420) : mySea(420)}
        {win}
      </div>
      <div aria-live="polite" style={{ textAlign: 'center', font: '400 13px/1.4 var(--font-sans)', color: G.soft, minHeight: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lastTxt}</div>
      <Fleet chips rows={fleetRows(view === 'foe' ? foe : me)} />
      {seated && !over && (
        <button type="button" disabled={!armed} onClick={() => { setSel({ ply: -1, cell: null }); send({ fire: pick }, pick) }} style={{
          minHeight: 56, borderRadius: 14, border: 0, cursor: armed ? 'pointer' : 'default', font: '800 17px/1 var(--font-sans)',
          background: armed ? FOE : G.inset, color: armed ? '#1a0a00' : G.muted,
        }}>{fireLabel}</button>
      )}
    </div>
  )
}

/** Loại hình cho tàu đối phương vừa chìm (không biết thứ tự hạm đội): theo độ dài; tàu 3 ô thứ hai vẽ tàu ngầm. */
function artOf(sunkList, j) {
  const n = sunkList[j].length
  if (n === 3) return sunkList.slice(0, j).some((s) => s.length === 3) ? 3 : 2
  return SHIPS.indexOf(n)
}
/** Số thứ tự loại tàu (tên) của tàu vừa chìm `cells` trong danh sách đã chìm. */
function sunkIndex(sunkList, cells) {
  const j = sunkList.findIndex((s) => s.length === cells.length && s.every((c) => cells.includes(c)))
  return artOf(sunkList, j < 0 ? sunkList.length - 1 : j)
}
