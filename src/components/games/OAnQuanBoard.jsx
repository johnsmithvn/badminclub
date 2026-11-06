import { useEffect, useId, useState } from 'react'
import { Button } from '#ds'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import { isQuanNon, sideOf } from '#lib/games/oanquan.js'

// Bàn Ô ăn quan bằng SVG: mặt gỗ, ô khoét, sỏi có khối, quan to màu đỏ (quan non vẽ mờ + ghi chú).
// Hàng của mình luôn nằm dưới: ghế 1 thì đọc ô i ở vị trí của ô i+6 (bàn đối xứng tâm), chữ số vẫn đứng
// thẳng; nhờ vậy "sang phải" luôn là dir +1 với hàng của mình.
// Nước vừa đi được diễn lại từng bước (bốc → rải từng viên → ăn) từ `state.last.frames` (lib/games/oanquan.js).
// Chạm bàn để xem ngay. Máy bật "giảm chuyển động" thì không diễn.

const C = 80 // cạnh một ô dân
const PAD = 10 // viền gỗ quanh các ô
const BAND = 30 // dải ghi điểm trên / dưới
const W = C * 7 + PAD * 2
const H = BAND * 2 + C * 2 + PAD * 2
// Sỏi lấy màu từ bảng màu gốc (không đổi theo sáng / tối) để viên sỏi có khối ở cả hai chế độ.
const PEBBLES = ['var(--gray-400)', 'var(--navy-300)', 'var(--gray-500)']
const QUAN = 'var(--status-incident)'
const WOOD = 'var(--status-delayed-bg)'
const INK = 'var(--status-delayed-fg)'
const mix = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, transparent)`

/** Khung của ô i khi chưa xoay: quan trái (0), hàng dưới 1..5, quan phải (6), hàng trên 11..7. */
function slot(i) {
  const y = BAND + PAD
  if (i === 0) return { x: PAD, y, w: C, h: C * 2, quan: 'L' }
  if (i === 6) return { x: PAD + C * 6, y, w: C, h: C * 2, quan: 'R' }
  return i < 6 ? { x: PAD + C * i, y: y + C, w: C, h: C } : { x: PAD + C * (12 - i), y, w: C, h: C }
}

/** Hình ô: ô dân bo tròn, ô quan hình bán nguyệt quay ra ngoài bàn. */
function pitPath(b) {
  const x0 = b.x + 5, x1 = b.x + b.w - 5, y0 = b.y + 5, y1 = b.y + b.h - 5
  if (b.quan === 'L') return `M${x1} ${y0} A${b.w - 10} ${(b.h - 10) / 2} 0 0 0 ${x1} ${y1} Z`
  if (b.quan === 'R') return `M${x0} ${y0} A${b.w - 10} ${(b.h - 10) / 2} 0 0 1 ${x0} ${y1} Z`
  const r = 16
  return `M${x0 + r} ${y0} H${x1 - r} A${r} ${r} 0 0 1 ${x1} ${y0 + r} V${y1 - r} A${r} ${r} 0 0 1 ${x1 - r} ${y1}`
    + ` H${x0 + r} A${r} ${r} 0 0 1 ${x0} ${y1 - r} V${y0 + r} A${r} ${r} 0 0 1 ${x0 + r} ${y0} Z`
}

/** Sỏi xếp xoắn ốc hoa hướng dương quanh tâm ô — đông mấy cũng gọn trong ô; quá 15 viên thì chỉ còn số. */
const pile = (cx, cy, n) => Array.from({ length: Math.min(n, 15) }, (_, k) => {
  const r = 6.6 * Math.sqrt(k)
  return [cx + r * Math.cos(k * 2.4), cy + r * Math.sin(k * 2.4)]
})

export default function OAnQuanBoard(props) {
  // Chỉ diễn lại nước đi tới trong lúc đang mở phòng; vào phòng giữa ván thì hiện ngay bàn hiện tại.
  const [mountPly] = useState(props.state.ply)
  const [still] = useState(() => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  // key theo ply: mỗi nước mới dựng lại Board → bộ đếm khung bắt đầu từ 0, ô đang chọn tự bỏ.
  return <Board key={props.state.ply} {...props} animate={!still && props.state.ply > mountPly} />
}

function Board({ state, mySeat, canMove, onMove, animate }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const isMobile = useMobile(768)
  const frames = animate && state.last?.frames?.length ? state.last.frames : null
  const [k, setK] = useState(frames ? 0 : null)
  const [picked, setPicked] = useState(null)
  // Cả nước đi diễn trong ~4 giây dù dài hay ngắn; khung đầu (lúc bốc) đứng lâu gấp đôi cho dễ theo.
  const tick = frames ? Math.max(70, Math.min(240, Math.round(4200 / frames.length))) : 0

  useEffect(() => {
    if (k == null) return undefined
    const id = setTimeout(() => setK(k + 1 < frames.length ? k + 1 : null), k === 0 ? tick * 2 : tick)
    return () => clearTimeout(id)
  }, [k, frames, tick])

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

  const go = (dir) => {
    if (sel == null) return
    setPicked(null)
    onMove({ cell: sel, dir })
  }

  return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <svg
        data-game-fx
        viewBox={`0 0 ${W} ${H}`}
        role="group"
        aria-label={t('games.oanquan.boardAria')}
        onClick={f ? () => setK(null) : undefined}
        style={{ width: '100%', maxWidth: 720, display: 'block', margin: '0 auto', touchAction: 'manipulation', userSelect: 'none', cursor: f ? 'pointer' : 'default' }}
      >
        <defs>
          {[...PEBBLES, QUAN].map((c, n) => (
            <radialGradient key={n} id={uid + 'g' + n} cx="38%" cy="32%" r="70%">
              <stop offset="0%" style={{ stopColor: 'var(--gray-0)', stopOpacity: 0.9 }} />
              <stop offset="38%" style={{ stopColor: c }} />
              <stop offset="100%" style={{ stopColor: `color-mix(in srgb, ${c} 62%, var(--navy-950))` }} />
            </radialGradient>
          ))}
        </defs>

        <rect x={0.5} y={BAND + 0.5} width={W - 1} height={C * 2 + PAD * 2 - 1} rx={22} fill={WOOD} stroke={mix(INK, 35)} />
        <line x1={PAD + C} y1={BAND + PAD + C} x2={PAD + C * 6} y2={BAND + PAD + C} stroke={mix(INK, 25)} strokeDasharray="2 6" />

        {[1 - bottom, bottom].map((seat, row) => (
          <text key={seat} x={W / 2} y={row ? H - 9 : 20} textAnchor="middle" fontSize={15}
            fill={view.turn === seat && !view.over ? 'var(--text-primary)' : 'var(--text-secondary)'}
            fontWeight={view.turn === seat && !view.over ? 600 : 400}>
            <tspan>{t('games.oanquan.mark' + seat)}</tspan>
            <tspan dx={8} style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{view.score[seat]}</tspan>
            <tspan dx={4}>{t('games.oanquan.points')}</tspan>
          </text>
        ))}

        {view.stones.map((n, i) => {
          const b = at(i)
          const cx = b.quan === 'L' ? b.x + 46 : b.quan === 'R' ? b.x + 34 : b.x + b.w / 2
          const cy = b.y + b.h / 2
          const hasQuan = view.quan[i]
          const non = isQuanNon(view, i)
          const tap = live && mine.includes(i) && n > 0
          const hot = f && f.at === i
          const path = pitPath(b)
          return (
            <g key={i} onClick={tap ? () => setPicked(picked === i ? null : i) : undefined}
              role={tap ? 'button' : undefined} aria-label={tap ? t('games.oanquan.cellAria', { n }) : undefined}
              style={{ cursor: tap ? 'pointer' : undefined }}>
              <path d={path} fill={mix(INK, tap ? 18 : 11)}
                stroke={sel === i ? 'var(--border-focus-color)' : hot ? 'var(--text-accent)' : mix(INK, 30)}
                strokeWidth={sel === i || hot ? 3 : 1.5}
                strokeDasharray={!f && state.last?.cell === i ? '7 5' : undefined} />
              {taken.has(i) && <path d={path} fill="var(--status-delivered-bg)" opacity={0.75} />}
              {f?.kind === 'eat' && hot && (
                <path key={'eat' + k} d={path} fill="var(--status-delivered-bg)" style={{ animation: 'gameFlash 600ms var(--ease-standard) both' }} />
              )}
              {refilled?.has(i) && <path d={path} fill="var(--status-transit-bg)" opacity={0.8} />}

              {hasQuan && (
                <g opacity={non ? 0.55 : 1}>
                  <circle cx={cx} cy={cy - 26} r={18} fill={`url(#${uid}g3)`} />
                  {non && <circle cx={cx} cy={cy - 26} r={23} fill="none" stroke={INK} strokeDasharray="3 4" />}
                </g>
              )}
              {pile(cx, hasQuan ? cy + 18 : cy, n).map(([x, y], s) => (
                <circle key={s} cx={x} cy={y} r={5.4} fill={`url(#${uid}g${(i + s) % 3})`}
                  style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'gamePop var(--dur-base) var(--ease-standard) both' }} />
              ))}

              {(n > 0 || hasQuan) && (
                <g>
                  <rect x={b.quan === 'R' ? b.x + 9 : b.x + b.w - 33} y={b.y + 9} width={24} height={18} rx={9} fill={mix(INK, 16)} />
                  <text x={b.quan === 'R' ? b.x + 21 : b.x + b.w - 21} y={b.y + 22} textAnchor="middle" fontSize={12} fontWeight={600}
                    fill={INK} style={{ fontFamily: 'var(--font-mono)' }}>{n}</text>
                </g>
              )}
              {non && (
                <text x={cx} y={b.y + b.h - 13} textAnchor="middle" fontSize={11} fill={INK}>{t('games.oanquan.young')}</text>
              )}
            </g>
          )
        })}

        {f && f.hand > 0 && (() => {
          const b = at(f.at)
          const x = b.quan === 'L' ? b.x + 46 : b.quan === 'R' ? b.x + 34 : b.x + b.w / 2
          return (
            <g key={'hand' + k} style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'gamePop var(--dur-fast) var(--ease-standard) both' }}>
              <circle cx={x} cy={b.y + 2} r={14} fill="var(--text-accent)" />
              <text x={x} y={b.y + 7} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--text-inverse)" style={{ fontFamily: 'var(--font-mono)' }}>{f.hand}</text>
            </g>
          )
        })()}

        {sel != null && (() => {
          const b = at(sel)
          const cy = b.y + b.h / 2
          return (
            <g>
              <path d={pitPath(b)} fill="var(--surface-card)" opacity={0.6} pointerEvents="none" />
              {[-1, 1].map((dir) => {
                const x = b.x + b.w / 2 + dir * 20
                return (
                  <g key={dir} onClick={(e) => { e.stopPropagation(); go(dir) }} style={{ cursor: 'pointer' }} role="button"
                    aria-label={t(dir === 1 ? 'games.oanquan.sowRight' : 'games.oanquan.sowLeft')}>
                    <rect x={dir === 1 ? b.x + b.w / 2 : b.x} y={b.y} width={b.w / 2} height={b.h} fill="transparent" />
                    <circle cx={x} cy={cy} r={15} fill="var(--text-accent)" />
                    <path d={`M${x - dir * 4} ${cy - 6} L${x + dir * 4} ${cy} L${x - dir * 4} ${cy + 6}`}
                      fill="none" stroke="var(--text-inverse)" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                )
              })}
            </g>
          )
        })()}
      </svg>

      {(canMove || f) && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', minHeight: isMobile ? 56 : 40 }}>
          {f
            ? <span style={S.hint}>{t('games.oanquan.skipHint')}</span>
            : sel == null
              ? <span style={S.hint}>{t('games.oanquan.pickHint')}</span>
              : (
                <>
                  <Button variant="secondary" size={isMobile ? 'touch' : 'md'} icon="arrow-left" onClick={() => go(-1)}>{t('games.oanquan.sowLeft')}</Button>
                  <Button size={isMobile ? 'touch' : 'md'} iconAfter="arrow-right" onClick={() => go(1)}>{t('games.oanquan.sowRight')}</Button>
                </>
              )}
        </div>
      )}
    </div>
  )
}

const S = {
  hint: { font: 'var(--type-caption)', color: 'var(--text-muted)', textAlign: 'center' },
}
