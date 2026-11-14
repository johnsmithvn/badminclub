import { Avatar } from '#ds'
import { G, card } from '#components/games/stage.js'

// Phần dùng chung của các bàn bài có "sân khấu" (Tiến lên, Phỏm): ảnh người chơi có vòng lượt, lớp màn kết thúc đè lên bàn.
// Mặt bàn, bố cục ghế, hiệu ứng là của từng game — không gom thành khuôn chung (mỗi game giữa bàn một khác).

/** Ảnh người chơi + vòng đếm giờ (khi tới lượt). `pct` 0–100 hoặc null = không đồng hồ. */
export function Seat({ name, src, size, active, pct, low, dim }) {
  const tc = low ? '#f87171' : G.teal
  const ring = active ? (pct != null ? `conic-gradient(${tc} ${pct}%, ${G.line} 0)` : G.teal) : G.line
  return (
    <div style={{ position: 'relative', width: size + 10, height: size + 10, borderRadius: '50%', background: ring, display: 'grid', placeItems: 'center', boxShadow: active ? '0 0 28px ' + G.tealA(0.5) : 'none', opacity: dim ? 0.55 : 1, transition: 'opacity .3s' }}>
      <div style={{ borderRadius: '50%', border: '3px solid ' + G.card, lineHeight: 0 }}><Avatar name={name} src={src} size={size - 6} /></div>
    </div>
  )
}

/** Lớp mờ phủ kín bàn + thẻ ở giữa (màn kết thúc). Bàn cha phải `position: relative`. */
export function Overlay({ width, maxHeight, children }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(5,8,16,.72)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center' }}>
      <div style={{ ...card, width, maxHeight, overflow: 'auto', padding: '24px 24px 20px', borderRadius: 22, display: 'grid', gap: 14, boxShadow: '0 30px 80px -20px rgba(0,0,0,.9)' }}>
        {children}
      </div>
    </div>
  )
}
