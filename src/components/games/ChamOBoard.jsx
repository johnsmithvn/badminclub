import { useId, useState } from 'react'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import { boxesOf, edgesOf, ends } from '#lib/games/chamo.js'

// Bàn Chấm ô bằng SVG: một trang vở ô ly (kẻ mờ, chấm nằm đúng giao điểm kẻ), nét bút đỏ (ghế 0) / bút xanh (ghế 1)
// cùng màu X / O của Caro. Nét mới vẽ dần từ chấm này sang chấm kia (gameDraw); ô vừa khép tô màu (gamePop) rồi
// X / O được "viết" vào giữa. Các nét của lượt gần nhất có quầng mờ — ăn ô thì một người nối liền nhiều nét, người kia
// nhìn quầng là biết vừa mất những ô nào. Rê chuột (máy tính) hoặc Tab tới một nét thì xem trước: ô sẽ khép tô màu
// mình, ô sẽ để lộ (đủ 3 cạnh mà nét này không ăn được ô nào) viền nét đứt màu đối phương. Luật: lib/games/chamo.js.

const W = 600 // bề ngang (= bề cao) tờ giấy
const BAND = 44 // dải người chơi trên / dưới
const H = W + BAND * 2
const M = 34 // lề giấy quanh lưới chấm
const INK = ['var(--status-incident-fg)', 'var(--status-scheduled-fg)']
const TINT = ['var(--status-incident-bg)', 'var(--status-scheduled-bg)']
const mix = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, transparent)`
const POP = { transformBox: 'fill-box', transformOrigin: 'center' }
/** Vẽ dần một nét dài `len` (gameDraw, effects.css) — props cho <line> / <circle>. */
const drawIn = (len, dur, delay = '0ms') => ({
  strokeDasharray: len,
  style: { '--game-len': len, animation: `gameDraw ${dur} var(--ease-out) ${delay} both` },
})

/** X (bút đỏ) / O (bút xanh) trong ô đã khép. `delay` (biểu thức thời gian CSS) = viết dần sau ngần ấy, null = hiện sẵn. */
function Mark({ seat, x, y, d, sw, delay }) {
  const write = (len, extra = '') => (delay == null ? null : drawIn(len, 'var(--dur-base)', `calc(${delay}${extra})`))
  if (seat === 0) {
    const len = Math.ceil(d * 2.83) + 1
    return (
      <g stroke={INK[0]} strokeWidth={sw} strokeLinecap="round">
        <line x1={x - d} y1={y - d} x2={x + d} y2={y + d} {...write(len)} />
        <line x1={x + d} y1={y - d} x2={x - d} y2={y + d} {...write(len, ' + var(--dur-fast)')} />
      </g>
    )
  }
  const r = d * 1.12
  return <circle cx={x} cy={y} r={r} fill="none" stroke={INK[1]} strokeWidth={sw} transform={`rotate(-90 ${x} ${y})`} {...write(Math.ceil(2 * Math.PI * r) + 1)} />
}

export default function ChamOBoard({ state, mySeat, canMove, onMove }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const isMobile = useMobile(768)
  const [hover, setHover] = useState(null)
  const { size: n, lines, boxes, last } = state
  const C = (W - 2 * M) / n // cạnh một ô
  const SW = Math.min(9, Math.max(5, C * 0.085)) // nét bút
  const LEN = Math.ceil(C) + 1
  const RULE = C / Math.round(C / 16) // kẻ ô ly ~16 đơn vị, chia đều cạnh ô → chấm rơi đúng giao điểm kẻ

  const pt = (r, c) => [M + c * C, BAND + M + r * C]
  const seg = (l) => {
    const [[r1, c1], [r2, c2]] = ends(n, l)
    return [...pt(r1, c1), ...pt(r2, c2)]
  }
  const corner = (b) => pt(Math.floor(b / n), b % n)
  const sides = (b, l) => edgesOf(n, b).filter((e) => lines[e] != null || e === l).length
  /** Nối thêm nét l thì ô nào khép (của mình), ô nào để lộ cho đối phương (đủ 3 cạnh mà nét này không ăn được ô nào). */
  const peek = (l) => {
    const adj = boxesOf(n, l)
    const won = adj.filter((b) => sides(b, l) === 4)
    return { won, gives: won.length ? [] : adj.filter((b) => sides(b, l) === 3) }
  }
  /** Vùng bấm của một nét: hình thoi giữa hai chấm và tâm hai ô kề — các vùng ghép kín bàn, chạm đâu cũng trúng một nét. */
  const kite = (l) => {
    const [x1, y1, x2, y2] = seg(l)
    const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2]
    const [[r, c]] = ends(n, l)
    const half = C / 2
    const out = Math.min(half, M - 4) // phía ngoài bàn chỉ tới mép giấy, không lấn sang dải tên
    if (y1 === y2) return `${x1},${y1} ${mx},${my - (r > 0 ? half : out)} ${x2},${y2} ${mx},${my + (r < n ? half : out)}`
    return `${x1},${y1} ${mx + (c < n ? half : out)},${my} ${x2},${y2} ${mx - (c > 0 ? half : out)},${my}`
  }

  const count = [0, 1].map((p) => boxes.filter((v) => v === p).length)
  const bottom = mySeat ?? 0
  const trail = new Set(last ? state.trail : [])
  const fresh = new Set(last?.boxes)
  // Ô người vừa đi khép được trong cả lượt gần nhất = ô của họ có cạnh thuộc lượt đó (ô khép từ trước thì đủ cạnh từ trước).
  const took = last ? boxes.filter((v, b) => v === last.seat && edgesOf(n, b).some((e) => trail.has(e))).length : 0
  const going = !!last && !state.over && state.turn === last.seat // vừa ăn ô, đang được đi tiếp
  const preview = canMove && hover != null && lines[hover] == null ? peek(hover) : null
  const mid = (l) => {
    const [x1, y1, x2, y2] = seg(l)
    return [(x1 + x2) / 2, (y1 + y2) / 2]
  }
  // Thứ tự Tab theo hàng đọc: trên xuống, trái sang.
  const free = canMove ? lines.flatMap((v, l) => (v == null ? [l] : [])).sort((a, b) => mid(a)[1] - mid(b)[1] || mid(a)[0] - mid(b)[0]) : []
  const k0 = Math.floor((M - 4) / RULE)
  const rules = []
  for (let j = -k0; M + j * RULE < W - 4; j++) rules.push(M + j * RULE)
  const put = (l) => { setHover(null); onMove({ line: l }) }

  let slot = { text: t('games.chamo.left', { n: n * n - count[0] - count[1] }) }
  if (going && last.seat === mySeat) slot = { text: t('games.chamo.extraMine', { n: took }), tone: S.good }
  else if (going) slot = { text: t('games.chamo.extraTheirs', { side: t('games.chamo.side' + last.seat), n: took }), tone: S.warn }
  else if (last && took > 0 && last.seat !== mySeat) slot = { text: t('games.chamo.took', { side: t('games.chamo.side' + last.seat), n: took }), tone: S.warn }

  return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      {/* Luôn giữ chỗ dòng này khi đang chơi: thông báo hiện / tắt mà đẩy bàn lên xuống là dễ chạm nhầm nét. */}
      {!state.over && <div style={{ ...S.slot, ...slot.tone }} aria-live="polite">{slot.text}</div>}

      <svg
        data-game-fx
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-label={t('games.chamo.boardAria', { n })}
        style={{ width: '100%', maxWidth: 560, display: 'block', margin: '0 auto', touchAction: 'manipulation', userSelect: 'none' }}
      >
        <defs>
          <clipPath id={uid + 'p'}><rect x={4} y={BAND + 4} width={W - 8} height={W - 8} rx={14} /></clipPath>
        </defs>

        {[1 - bottom, bottom].map((seat, row) => {
          const y = row ? H - BAND / 2 : BAND / 2
          const on = state.turn === seat && !state.over
          return (
            <g key={seat}>
              <g transform={`translate(${M} ${y})`}>
                {on && <circle r={17} fill="none" stroke="var(--text-accent)" strokeWidth={2.5} />}
                <circle r={12.5} fill={TINT[seat]} stroke={INK[seat]} strokeWidth={1.5} />
                <Mark seat={seat} x={0} y={0} d={4.6} sw={2.4} delay={null} />
              </g>
              <text x={M + 26} y={y + 6} fontSize={16} fill={on ? 'var(--text-primary)' : 'var(--text-secondary)'} fontWeight={on ? 600 : 400}>
                {t('games.chamo.mark' + seat)}
              </text>
              <text x={W - M} y={y + 7} textAnchor="end" fontSize={20} fontWeight={600} fill="var(--text-primary)" style={{ fontFamily: 'var(--font-mono)' }}>
                {count[seat]}
                <tspan dx={6} fontSize={14} fontWeight={400} fill="var(--text-muted)" style={{ fontFamily: 'var(--font-sans)' }}>{t('games.chamo.boxes')}</tspan>
              </text>
            </g>
          )
        })}

        {/* Tờ giấy: một tờ lót lệch xuống làm bóng, tờ trên kẻ ô ly mờ. */}
        <rect x={10} y={BAND + 11} width={W - 20} height={W - 10} rx={14} fill={mix('var(--text-primary)', 7)} />
        <rect x={4} y={BAND + 4} width={W - 8} height={W - 8} rx={14} fill="var(--surface-card)" />
        <g clipPath={`url(#${uid}p)`} stroke={mix(INK[1], 13)} strokeWidth={1}>
          {rules.map((p, j) => [
            <line key={'v' + j} x1={p} y1={BAND + 4} x2={p} y2={BAND + W - 4} />,
            <line key={'h' + j} x1={4} y1={BAND + p} x2={W - 4} y2={BAND + p} />,
          ])}
        </g>
        <rect x={4} y={BAND + 4} width={W - 8} height={W - 8} rx={14} fill="none" stroke="var(--border-default)" />

        {boxes.map((v, b) => {
          if (v == null) return null
          const [x, y] = corner(b)
          const pop = fresh.has(b) ? { ...POP, animation: 'gamePop var(--dur-base) var(--ease-out) var(--dur-slow) both' } : undefined
          return <rect key={'b' + b} x={x} y={y} width={C} height={C} fill={TINT[v]} style={pop} />
        })}

        {preview && (
          <g pointerEvents="none">
            {preview.won.map((b) => {
              const [x, y] = corner(b)
              return <rect key={'pw' + b} x={x} y={y} width={C} height={C} fill={TINT[mySeat]} opacity={0.75} />
            })}
            {preview.gives.map((b) => {
              const [x, y] = corner(b)
              return (
                <rect key={'pg' + b} x={x + SW} y={y + SW} width={C - 2 * SW} height={C - 2 * SW} rx={6}
                  fill={mix(INK[1 - mySeat], 6)} stroke={INK[1 - mySeat]} strokeWidth={2} strokeDasharray="6 5" />
              )
            })}
          </g>
        )}

        {[...trail].map((l) => {
          const [x1, y1, x2, y2] = seg(l)
          return (
            <line key={'g' + l} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK[last.seat]} strokeWidth={SW * 2.8} strokeLinecap="round" opacity={0.16}
              pointerEvents="none" {...(l === last.line ? drawIn(LEN, 'var(--dur-slow)') : null)} />
          )
        })}

        {lines.map((v, l) => {
          if (v == null) return null
          const [x1, y1, x2, y2] = seg(l)
          return (
            <line key={'l' + l} x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK[v]} strokeWidth={SW} strokeLinecap="round"
              pointerEvents="none" {...(l === last?.line ? drawIn(LEN, 'var(--dur-slow)') : null)} />
          )
        })}

        {preview && (() => {
          const [x1, y1, x2, y2] = seg(hover)
          return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK[mySeat]} strokeWidth={SW} strokeLinecap="round" opacity={0.42} pointerEvents="none" />
        })()}

        {boxes.map((v, b) => {
          if (v == null) return null
          const [x, y] = corner(b)
          return (
            <Mark key={'m' + b} seat={v} x={x + C / 2} y={y + C / 2} d={Math.min(C * 0.17, 30)} sw={Math.max(3, SW * 0.7)}
              delay={fresh.has(b) ? 'var(--dur-slow) + var(--dur-base)' : null} />
          )
        })}

        <g fill="var(--text-primary)" pointerEvents="none">
          {Array.from({ length: (n + 1) * (n + 1) }, (_, k) => {
            const [x, y] = pt(Math.floor(k / (n + 1)), k % (n + 1))
            return <circle key={k} cx={x} cy={y} r={Math.min(7, Math.max(4.5, C * 0.065))} />
          })}
        </g>

        {free.map((l) => {
          const p = peek(l)
          const [[r, c], [r2]] = ends(n, l)
          const what = p.won.length ? t('games.chamo.closes', { n: p.won.length }) : p.gives.length ? t('games.chamo.gives', { n: p.gives.length }) : ''
          return (
            <polygon key={'hit' + l} points={kite(l)} fill="transparent"
              role="button"
              tabIndex={0}
              aria-label={t(r2 === r ? 'games.chamo.lineH' : 'games.chamo.lineV', { r: r + 1, c: c + 1 }) + (what ? ', ' + what : '')}
              style={{ cursor: 'pointer', outline: 'none' }}
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(l) }}
              onPointerLeave={() => setHover((h) => (h === l ? null : h))}
              onFocus={() => setHover(l)}
              onBlur={() => setHover((h) => (h === l ? null : h))}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); put(l) } }}
              onClick={() => put(l)} />
          )
        })}
      </svg>

      {canMove && (
        <div style={{ ...S.hint, minHeight: isMobile ? 40 : 24, ...(preview?.gives.length ? { color: 'var(--status-delayed-fg)' } : null) }}>
          {preview?.won.length
            ? t('games.chamo.hintCloses', { n: preview.won.length })
            : preview?.gives.length ? t('games.chamo.hintGives', { n: preview.gives.length }) : t('games.chamo.pickHint')}
        </div>
      )}
    </div>
  )
}

const S = {
  hint: { font: 'var(--type-caption)', color: 'var(--text-muted)', textAlign: 'center' },
  slot: { justifySelf: 'center', padding: '6px 12px', borderRadius: 99, textAlign: 'center', font: 'var(--type-caption)', color: 'var(--text-muted)' },
  good: { background: 'var(--status-delivered-bg)', color: 'var(--status-delivered-fg)' },
  warn: { background: 'var(--status-delayed-bg)', color: 'var(--status-delayed-fg)' },
}
