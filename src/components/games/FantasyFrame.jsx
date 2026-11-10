import { F } from '#components/games/fantasyTone.js'

// Khung bàn "fantasy" dùng chung cho Cờ vua và Cờ tướng. Chỉ dùng gradient (không filter / blur) để máy yếu vẫn mượt.
// `uid` = tiền tố id riêng của từng bàn (useId) — hai bàn trên cùng trang không giẫm id của nhau.

/** Gradient dùng chung — đặt trong <defs> của bàn. */
export function FantasyDefs({ uid }) {
  return (
    <>
      <linearGradient id={uid + 'frame'} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={F.frame0} />
        <stop offset="100%" stopColor={F.frame1} />
      </linearGradient>
      <linearGradient id={uid + 'gold'} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={F.gold0} />
        <stop offset="45%" stopColor={F.gold1} />
        <stop offset="100%" stopColor={F.gold2} />
      </linearGradient>
      {/* Phủ lên mặt bàn: giữa hơi sáng, bốn mép tối dần — cho bàn có chiều sâu. */}
      <radialGradient id={uid + 'vig'} cx="50%" cy="46%" r="72%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity={0.09} />
        <stop offset="55%" stopColor="#ffffff" stopOpacity={0} />
        <stop offset="100%" stopColor={F.shade} stopOpacity={0.42} />
      </radialGradient>
      <radialGradient id={uid + 'chk'}>
        <stop offset="0%" stopColor={F.danger} stopOpacity={0.95} />
        <stop offset="100%" stopColor={F.danger} stopOpacity={0} />
      </radialGradient>
    </>
  )
}

/** Nền khung + viền vàng quanh mặt bàn `field` = { x, y, w, h } + bốn viên ngọc ở góc. Vẽ TRƯỚC mặt bàn. */
export function FantasyFrame({ uid, w, h, field }) {
  const gold = `url(#${uid}gold)`
  const x0 = field.x - 3, y0 = field.y - 3, x1 = field.x + field.w + 3, y1 = field.y + field.h + 3
  return (
    <>
      <rect x={1} y={1} width={w - 2} height={h - 2} rx={16} fill={`url(#${uid}frame)`} stroke={F.gold2} strokeWidth={1.5} />
      <rect x={6.5} y={6.5} width={w - 13} height={h - 13} rx={11} fill="none" stroke={gold} strokeWidth={1} opacity={0.5} />
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx={3} fill="none" stroke={gold} strokeWidth={2.5} />
    </>
  )
}

/** Phủ chiều sâu lên mặt bàn + ngọc ở bốn góc viền. Vẽ SAU mặt bàn, TRƯỚC quân. */
export function FantasyGloss({ uid, field }) {
  const x0 = field.x - 3, y0 = field.y - 3, x1 = field.x + field.w + 3, y1 = field.y + field.h + 3
  return (
    <g pointerEvents="none">
      <rect x={field.x} y={field.y} width={field.w} height={field.h} fill={`url(#${uid}vig)`} />
      {[[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([cx, cy]) => (
        <g key={cx + '-' + cy} transform={`translate(${cx} ${cy}) rotate(45)`}>
          <rect x={-5} y={-5} width={10} height={10} rx={1.5} fill={F.gem} stroke={`url(#${uid}gold)`} strokeWidth={1.8} />
          <rect x={-3.2} y={-3.2} width={3} height={3} fill="#ffffff" opacity={0.7} />
        </g>
      ))}
    </g>
  )
}
