// Sáu linh vật Bầu cua — tranh tự vẽ, màu theo token (tự đổi sáng / tối). Dùng chung cho bàn chơi và tranh sảnh.
// Thứ tự = SYMS của lib/games/baucua.js: bầu, cua, tôm, cá, gà, nai. Hệ toạ độ 48 × 48, gốc (0, 0).

const INK = 'var(--navy-950)'

const ART = [
  // Bầu: hai bầu tròn chồng nhau, cuống và lá.
  () => (
    <>
      <circle cx={24} cy={31} r={12} fill="var(--status-delivered)" />
      <circle cx={24} cy={16} r={7.5} fill="var(--status-delivered)" />
      <circle cx={20} cy={27} r={3.5} fill="var(--gray-0)" opacity={0.25} />
      <path d="M24 9 V4" stroke={INK} strokeWidth={2} strokeLinecap="round" />
      <path d="M24 6 q7 -5 11 1 q-6 3 -11 -1z" fill="var(--status-delivered-fg)" />
    </>
  ),
  // Cua: mai bầu dục, hai càng, chân hai bên.
  () => (
    <>
      <g stroke="var(--status-incident)" strokeWidth={2.2} strokeLinecap="round">
        <path d="M13 28 l-7 4 M13 32 l-6 6 M35 28 l7 4 M35 32 l6 6" />
        <path d="M15 22 L10 14 M33 22 L38 14" />
      </g>
      <path d="M5 11 a5 5 0 1 1 8 4 l-3 -3z M43 11 a5 5 0 1 0 -8 4 l3 -3z" fill="var(--status-incident)" />
      <ellipse cx={24} cy={28} rx={12} ry={9} fill="var(--status-incident)" />
      <circle cx={20} cy={21} r={1.8} fill={INK} />
      <circle cx={28} cy={21} r={1.8} fill={INK} />
    </>
  ),
  // Tôm: thân cong nhiều đốt, đuôi xoè, râu dài.
  () => (
    <>
      <path d="M12 12 C30 6 40 18 34 30 C30 38 20 38 16 34" fill="none" stroke="var(--status-delayed)" strokeWidth={8} strokeLinecap="round" />
      <g stroke="var(--status-delayed-bg)" strokeWidth={1.4}>
        <path d="M26 9 l-2 7 M32 14 l-5 5 M35 22 l-6 2 M33 30 l-6 -1" />
      </g>
      <path d="M16 34 l-8 2 l4 6 z" fill="var(--status-delayed)" />
      <path d="M12 12 C6 8 4 4 8 2 M12 12 C8 14 3 14 2 10" fill="none" stroke={INK} strokeWidth={1.2} />
      <circle cx={14} cy={11} r={1.6} fill={INK} />
    </>
  ),
  // Cá: thân bầu dục, đuôi tam giác, vây lưng, mắt.
  () => (
    <>
      <path d="M34 24 L45 15 L45 33 Z" fill="var(--navy-400)" />
      <path d="M17 15 q8 -8 14 2z" fill="var(--navy-400)" />
      <ellipse cx={21} cy={24} rx={16} ry={10} fill="var(--navy-400)" />
      <path d="M18 18 q4 6 0 12" fill="none" stroke="var(--gray-0)" strokeOpacity={0.5} strokeWidth={1.4} />
      <circle cx={11} cy={22} r={2.2} fill="var(--gray-0)" />
      <circle cx={11} cy={22} r={1.1} fill={INK} />
    </>
  ),
  // Gà: thân tròn, mào đỏ, mỏ, đuôi cong.
  () => (
    <>
      <path d="M33 26 q10 -14 12 -2 q-2 8 -9 10z" fill="var(--status-delivered-fg)" />
      <circle cx={24} cy={30} r={11} fill="var(--status-delayed)" />
      <circle cx={16} cy={17} r={7} fill="var(--status-delayed)" />
      <path d="M11 11 q1 -5 4 -2 q1 -5 4 -1 q2 -4 4 1 q-6 2 -12 2z" fill="var(--status-incident)" />
      <path d="M9 17 l-5 2 l5 2z" fill="var(--status-delayed-fg)" />
      <path d="M12 22 q-1 5 2 5 q2 -3 0 -5z" fill="var(--status-incident)" />
      <circle cx={14} cy={16} r={1.5} fill={INK} />
      <path d="M20 41 v5 M27 41 v5" stroke="var(--status-delayed-fg)" strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  // Nai: đầu thon, tai, gạc chẻ nhánh.
  () => (
    <>
      <g stroke="var(--status-delayed-fg)" strokeWidth={2.2} strokeLinecap="round" fill="none">
        <path d="M19 16 L13 6 M15 10 L9 9 M13 6 L12 1" />
        <path d="M29 16 L35 6 M33 10 L39 9 M35 6 L36 1" />
      </g>
      <path d="M17 18 l-8 -2 l6 7z M31 18 l8 -2 l-6 7z" fill="var(--status-delayed-fg)" />
      <path d="M16 20 Q24 13 32 20 L29 38 Q24 45 19 38 Z" fill="var(--status-delayed-fg)" />
      <circle cx={20} cy={24} r={1.7} fill="var(--gray-0)" />
      <circle cx={28} cy={24} r={1.7} fill="var(--gray-0)" />
      <ellipse cx={24} cy={39} rx={3} ry={2.2} fill={INK} />
    </>
  ),
]

/** Linh vật thứ `sym` (0..5), vẽ trong ô `size` px. Đặt trong <svg> thì dùng `g`, đứng riêng thì tự bọc <svg>. */
export function BauCuaIcon({ sym, size = 48, g = false, x = 0, y = 0 }) {
  const Art = ART[sym]
  if (g) return <g transform={`translate(${x} ${y}) scale(${size / 48})`}><Art /></g>
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <Art />
    </svg>
  )
}
