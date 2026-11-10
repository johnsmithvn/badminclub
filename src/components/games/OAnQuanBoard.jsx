import { useCallback, useEffect, useState } from 'react'
import { Button } from '#ds'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import { isQuanNon, queueStates, sideOf } from '#lib/games/oanquan.js'
import cfg from '#config/app.js'

// Bàn Ô ăn quan bằng SVG, vẽ phẳng theo design system (không bóng, không gradient): bàn hình viên thuốc như bàn
// vẽ phấn — hai đầu bán nguyệt là ô quan —, sỏi mờ một màu có viền mảnh, quan là viên đá lớn màu đỏ (quan non vẽ
// mờ + ghi chú). Sỏi trong ô xếp CÂN quanh tâm (vòng tròn đều), số sỏi ghi ở mép ô phía người chơi.
// Hàng của mình luôn nằm dưới: ghế 1 thì đọc ô i ở vị trí của ô i+6 (bàn đối xứng tâm), chữ số vẫn đứng
// thẳng; nhờ vậy "sang phải" luôn là dir +1 với hàng của mình.
// Nước vừa đi được diễn lại từng bước (bốc → rải từng viên → ăn) từ `state.last.frames` (lib/games/oanquan.js).
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

const C = 80 // cạnh một ô dân
const PAD = 10 // viền gỗ quanh các ô
const BAND = 30 // dải ghi điểm trên / dưới
const W = C * 7 + PAD * 2
const H = BAND * 2 + C * 2 + PAD * 2
const MID = BAND + PAD + C // đường giữa hai hàng
// Sỏi lấy màu từ bảng màu gốc (không đổi theo sáng / tối) để nổi trên mặt gỗ ở cả hai chế độ.
const PEBBLES = ['var(--gray-400)', 'var(--navy-300)', 'var(--gray-500)']
const QUAN = 'var(--status-incident)'
const WOOD = 'var(--status-delayed-bg)'
const INK = 'var(--status-delayed-fg)'
const mix = (c, pct) => `color-mix(in srgb, ${c} ${pct}%, transparent)`
const EDGE = mix('var(--navy-950)', 32) // viền sỏi / quan

/** Khung của ô i khi chưa xoay: quan trái (0), hàng dưới 1..5, quan phải (6), hàng trên 11..7. */
function slot(i) {
  const y = BAND + PAD
  if (i === 0) return { x: PAD, y, w: C, h: C * 2, quan: 'L' }
  if (i === 6) return { x: PAD + C * 6, y, w: C, h: C * 2, quan: 'R' }
  return i < 6 ? { x: PAD + C * i, y: y + C, w: C, h: C } : { x: PAD + C * (12 - i), y, w: C, h: C, top: true }
}

/** Hình ô: ô dân bo tròn, ô quan nửa hình tròn đồng dạng với đầu bàn. */
function pitPath(b) {
  const x0 = b.x + 5, x1 = b.x + b.w - 5, y0 = b.y + 5, y1 = b.y + b.h - 5
  const R = (b.h - 10) / 2
  if (b.quan === 'L') return `M${x1} ${y0} A${R} ${R} 0 0 0 ${x1} ${y1} Z`
  if (b.quan === 'R') return `M${x0} ${y0} A${R} ${R} 0 0 1 ${x0} ${y1} Z`
  const r = 16
  return `M${x0 + r} ${y0} H${x1 - r} A${r} ${r} 0 0 1 ${x1} ${y0 + r} V${y1 - r} A${r} ${r} 0 0 1 ${x1 - r} ${y1}`
    + ` H${x0 + r} A${r} ${r} 0 0 1 ${x0} ${y1 - r} V${y0 + r} A${r} ${r} 0 0 1 ${x0 + r} ${y0} Z`
}

/** Tâm ô. Ô quan: trọng tâm nửa hình tròn (4R / 3π ≈ 32 tính từ cạnh thẳng) — hai quan đối xứng qua giữa bàn. */
const centerOf = (b) => ({ cx: b.quan === 'L' ? b.x + b.w - 37 : b.quan === 'R' ? b.x + 37 : b.x + b.w / 2, cy: b.y + b.h / 2 })

const PEB = 4.8 // bán kính viên sỏi
const GAP = 10.6 // khoảng cách tâm hai viên kề nhau
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
const POP = { transformBox: 'fill-box', transformOrigin: 'center', animation: 'gamePop var(--dur-base) var(--ease-standard) both' }
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
  const frames = animate && state.last?.frames?.length ? state.last.frames : null
  const [k, setK] = useState(frames ? 0 : null)
  const [picked, setPicked] = useState(null)
  // Ở ×1 cả nước đi diễn trong ~4 giây dù dài hay ngắn; ×N thì nhịp chia N. Khung đầu (lúc bốc) đứng lâu gấp đôi cho dễ theo.
  const tick = frames ? Math.round(Math.max(70, Math.min(240, 4200 / frames.length)) / (speed || 1)) : 0

  useEffect(() => {
    if (k == null) return undefined
    const id = setTimeout(() => setK(k + 1 < frames.length ? k + 1 : null), k === 0 ? tick * 2 : tick)
    return () => clearTimeout(id)
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
        {/* Bàn hình viên thuốc: bán kính góc = nửa chiều cao, hai đầu tròn ôm đúng hai ô quan. */}
        <rect x={0.5} y={BAND + 0.5} width={W - 1} height={C * 2 + PAD * 2 - 1} rx={C + PAD} fill={WOOD} stroke={mix(INK, 30)} />
        <line x1={PAD + C} y1={MID} x2={PAD + C * 6} y2={MID} stroke={mix(INK, 22)} strokeDasharray="2 6" />

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
          const { cx, cy } = centerOf(b)
          const hasQuan = view.quan[i]
          const non = isQuanNon(view, i)
          const tap = live && mine.includes(i) && n > 0
          const hot = f && f.at === i
          const path = pitPath(b)
          // Đống sỏi: ô dân lùi 5 về phía đường giữa nhường chỗ cho con số ở mép ngoài; ô quan nằm dưới viên quan.
          const py = b.quan ? (hasQuan ? cy + 20 : cy) : cy + (b.top ? 5 : -5)
          const numY = b.quan ? cy + 60 : b.top ? b.y + 20 : b.y + b.h - 10
          const spots = PILES[Math.min(n, MAX_DRAWN)]
          return (
            <g key={i} onClick={tap ? () => setPicked(picked === i ? null : i) : undefined}
              role={tap ? 'button' : undefined} aria-label={tap ? t('games.oanquan.cellAria', { n }) : undefined}
              style={{ cursor: tap ? 'pointer' : undefined }}>
              <path d={path} fill={mix(INK, tap ? 16 : 9)}
                stroke={sel === i ? 'var(--border-focus-color)' : hot ? 'var(--text-accent)' : mix(INK, 24)}
                strokeWidth={sel === i || hot ? 3 : 1}
                strokeDasharray={!f && state.last?.cell === i ? '7 5' : undefined} />
              {taken.has(i) && <path d={path} fill="var(--status-delivered-bg)" opacity={0.75} />}
              {f?.kind === 'eat' && hot && (
                <path key={'eat' + k} d={path} fill="var(--status-delivered-bg)" style={{ animation: 'gameFlash 600ms var(--ease-standard) both' }} />
              )}
              {refilled?.has(i) && <path d={path} fill="var(--status-transit-bg)" opacity={0.8} />}

              {hasQuan && (
                <g opacity={non ? 0.5 : 1}>
                  <ellipse cx={cx} cy={cy - 34} rx={14} ry={17} fill={QUAN} stroke={EDGE} />
                  {non && <ellipse cx={cx} cy={cy - 34} rx={19} ry={22} fill="none" stroke={INK} strokeDasharray="3 4" />}
                </g>
              )}
              {/* Viên cũ trượt về chỗ mới khi ô thêm sỏi; chỉ viên VỪA RƠI (hoặc vừa rải lại) mới hiện dần. */}
              {spots.map(([dx, dy], s) => (
                <g key={s} style={{ transform: `translate(${cx + dx}px, ${py + dy}px)`, transition: GLIDE }}>
                  <circle r={PEB} fill={PEBBLES[(i + s) % 3]} stroke={EDGE} strokeWidth={0.8}
                    style={refilled?.has(i) || (hot && f.kind === 'drop' && s === spots.length - 1) ? POP : undefined} />
                </g>
              ))}

              {(n > 0 || hasQuan) && (
                <text x={cx} y={numY} textAnchor="middle" fontSize={11} fontWeight={600} fill={INK} style={{ fontFamily: 'var(--font-mono)' }}>{n}</text>
              )}
              {non && (
                <text x={cx} y={cy - 4} textAnchor="middle" fontSize={10} fill={INK}>{t('games.oanquan.young')}</text>
              )}
            </g>
          )
        })}

        {/* Số sỏi đang cầm: ô dân thì nằm sát đường giữa, nhích vào ô đang rải (không đè con số ở mép ngoài); ô quan thì trên đỉnh ô. */}
        {f && f.hand > 0 && (() => {
          const b = at(f.at)
          const x = centerOf(b).cx
          const y = b.quan ? b.y + 14 : MID + (b.top ? -6 : 6)
          return (
            <g key={'hand' + k} style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: 'gamePop var(--dur-fast) var(--ease-standard) both' }}>
              <circle cx={x} cy={y} r={13} fill="var(--text-accent)" />
              <text x={x} y={y + 4.5} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--text-inverse)" style={{ fontFamily: 'var(--font-mono)' }}>{f.hand}</text>
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

      {/* Tốc độ diễn lại — hàng riêng để không xô lệch hàng nút rải. Máy bật "giảm chuyển động" (không diễn) thì ẩn. */}
      {speed != null && (
        <div role="group" aria-label={t('games.oanquan.speed')} style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
          <span style={S.hint}>{t('games.oanquan.speed')}</span>
          {SPEEDS.map((n) => (
            <Button key={n} size="sm" variant={speed === n ? 'primary' : 'secondary'} aria-pressed={speed === n} onClick={() => onSpeed(n)}>
              {t('games.oanquan.speedOpt', { n })}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

const S = {
  hint: { font: 'var(--type-caption)', color: 'var(--text-muted)', textAlign: 'center' },
}
