import { Avatar } from '#ds'
import { CARD, G, card } from '#components/games/stage.js'
import { Bubble } from '#components/games/ChessStage.jsx'

// Phần dùng chung của các bàn bài có "sân khấu" (Tiến lên, Phỏm, Xì dách, Ba cây, Bài bịp): ảnh người chơi có vòng lượt, lớp màn kết thúc đè lên bàn.
// Mặt bàn, bố cục ghế, hiệu ứng là của từng game — không gom thành khuôn chung (mỗi game giữa bàn một khác).

/**
 * Ảnh người chơi + vòng đếm giờ (khi tới lượt). `pct` 0–100 hoặc null = không đồng hồ.
 * `bubble` = tin chat vừa gửi (useBubbles, GameRoom truyền `bubbles`) nổi cạnh ảnh; `up` = mở lên trên (ghế dưới đáy).
 */
export function Seat({ name, src, size, active, pct, low, dim, bubble, up }) {
  const timed = active && pct != null
  return (
    <div style={{ position: 'relative', width: size + 10, height: size + 10, borderRadius: '50%', background: active && !timed ? G.teal : G.line, display: 'grid', placeItems: 'center', boxShadow: active ? '0 0 28px ' + G.tealA(0.5) : 'none', opacity: dim ? 0.55 : 1, transition: 'opacity .3s' }}>
      <div style={{ borderRadius: '50%', border: '3px solid ' + G.card, lineHeight: 0 }}><Avatar name={name} src={src} size={size - 6} /></div>
      {/* Vòng giờ nét liền rút dần (bản thiết kế: SVG stroke-dasharray). */}
      {timed && (
        <svg aria-hidden="true" viewBox="0 0 52 52" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)', pointerEvents: 'none' }}>
          <circle cx="26" cy="26" r="23.5" fill="none" stroke={low ? '#f87171' : G.teal} strokeWidth="5" strokeDasharray="148" strokeDashoffset={148 * (1 - Math.max(0, Math.min(100, pct)) / 100)} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
        </svg>
      )}
      {bubble && <Bubble key={bubble.at} msg={bubble} up={up} />}
    </div>
  )
}

/**
 * Cảnh chia bài (bản thiết kế Ba cây / Phỏm / Xì dách): lưng lá bay từ `from` tới từng chỗ trong `to`, lần lượt từng
 * vòng, mỗi lá trễ `step` giây. Đặt trong lớp hiệu ứng `position: absolute` của bàn; `id` đổi = diễn lại.
 */
export function DealFx({ id, from, to, rounds = 3, w = 28, step = 0.045 }) {
  const out = []
  let k = 0
  for (let r = 0; r < rounds; r++) {
    to.forEach(([x, y], i) => {
      out.push(<span key={id + '-' + r + '-' + i} aria-hidden="true" style={{
        position: 'absolute', left: x, top: y, width: w, height: Math.round(w * 1.4), borderRadius: 4, background: CARD.back, border: '1.5px solid ' + CARD.backLine,
        boxShadow: '0 6px 14px rgba(0,0,0,.5)', '--fx': from[0] - x + 'px', '--fy': from[1] - y + 'px', '--r': (r - 1) * 8 + 'deg',
        opacity: 0, animation: `tlDeal .38s cubic-bezier(.3,.7,.2,1) ${(k++ * step).toFixed(3)}s forwards`, zIndex: 30, pointerEvents: 'none',
      }} />)
    })
  }
  return <>{out}</>
}

/** Lớp mờ phủ kín bàn + thẻ ở giữa (màn kết thúc). Bàn cha phải `position: relative`. `delay` (giây) = hiện trễ. */
export function Overlay({ width, maxHeight, delay, children }) {
  return (
    <div style={{ animation: delay ? `skFade .4s ease-out ${delay}s both` : undefined, position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(5,8,16,.72)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center' }}>
      <div style={{ ...card, width, maxHeight, overflow: 'auto', padding: '24px 24px 20px', borderRadius: 22, display: 'grid', gap: 14, boxShadow: '0 30px 80px -20px rgba(0,0,0,.9)' }}>
        {children}
      </div>
    </div>
  )
}
