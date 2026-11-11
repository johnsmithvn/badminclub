// Sáu linh vật Bầu cua — tranh theo bản thiết kế "Bầu Cua Tôm Cá" (2026-11-11). Màu viết cứng: con vật là "vật" có màu
// riêng, giữ nguyên ở cả sáng / tối (DESIGN.md §2.4). Dùng chung cho bàn chơi và tranh sảnh.
// Thứ tự = SYMS của lib/games/baucua.js: bầu, cua, tôm, cá, gà, nai. Hệ toạ độ 120 × 120, gốc (0, 0).

const ART = [
  // Bầu
  () => (
    <g stroke="#2a1810" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
      <path d="M61 24 C60 16 63 11 69 8" fill="none" strokeWidth="5" />
      <path d="M68 9 C76 0 92 3 97 13 C88 21 75 20 68 9 Z" fill="#3f7d3a" />
      <path d="M70 10 C78 9 86 10 94 13" fill="none" strokeWidth="1.6" />
      <path d="M58 14 C50 14 46 8 50 4 C54 1 58 5 55 8" fill="none" strokeWidth="2.2" />
      <path d="M60 22 C49 22 43 30 43 39 C43 47 48 51 50 56 C35 60 24 72 24 87 C24 103 40 113 60 113 C80 113 96 103 96 87 C96 72 85 60 70 56 C72 51 77 47 77 39 C77 30 71 22 60 22 Z" fill="#7dae3c" />
      <path d="M34 88 C34 76 41 68 50 65" fill="none" stroke="#d6ec9a" strokeWidth="4" />
      <path d="M50 38 C50 32 53 29 57 28" fill="none" stroke="#d6ec9a" strokeWidth="3.5" />
      <path d="M60 62 C66 76 66 96 60 110" fill="none" strokeWidth="1.6" opacity=".55" />
      <path d="M76 66 C86 76 88 92 80 104" fill="none" strokeWidth="1.6" opacity=".55" />
      <path d="M48 54 C56 60 64 60 72 54" fill="none" stroke="#c8372d" strokeWidth="6" />
      <path d="M48 54 C56 60 64 60 72 54" fill="none" strokeWidth="1.4" transform="translate(0 4.2)" />
      <path d="M72 55 C80 56 84 62 82 70 M72 55 C78 60 78 66 74 72" fill="none" stroke="#c8372d" strokeWidth="3.5" />
    </g>
  ),
  // Cua
  () => (
    <g stroke="#2a1810" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
      <path d="M36 70 Q18 66 9 78 M36 78 Q20 82 13 96 M40 86 Q30 94 29 108" fill="none" strokeWidth="8" />
      <path d="M36 70 Q18 66 9 78 M36 78 Q20 82 13 96 M40 86 Q30 94 29 108" fill="none" stroke="#d2432c" strokeWidth="4" />
      <path d="M40 58 Q27 52 25 40" fill="none" strokeWidth="11" />
      <path d="M40 58 Q27 52 25 40" fill="none" stroke="#d2432c" strokeWidth="6" />
      <path d="M26 42 C10 40 4 22 16 11 C17 21 23 26 30 25 C27 18 29 11 35 7 C46 17 43 39 26 42 Z" fill="#e2573a" />
      <path d="M17 30 C19 35 24 37 29 36" fill="none" stroke="#f6a57f" strokeWidth="2.5" />
      <g transform="translate(120 0) scale(-1 1)">
      <path d="M36 70 Q18 66 9 78 M36 78 Q20 82 13 96 M40 86 Q30 94 29 108" fill="none" strokeWidth="8" />
      <path d="M36 70 Q18 66 9 78 M36 78 Q20 82 13 96 M40 86 Q30 94 29 108" fill="none" stroke="#d2432c" strokeWidth="4" />
      <path d="M40 58 Q27 52 25 40" fill="none" strokeWidth="11" />
      <path d="M40 58 Q27 52 25 40" fill="none" stroke="#d2432c" strokeWidth="6" />
      <path d="M26 42 C10 40 4 22 16 11 C17 21 23 26 30 25 C27 18 29 11 35 7 C46 17 43 39 26 42 Z" fill="#e2573a" />
      <path d="M17 30 C19 35 24 37 29 36" fill="none" stroke="#f6a57f" strokeWidth="2.5" />
      </g>
      <path d="M52 50 L49 39 M68 50 L71 39" fill="none" strokeWidth="3.5" />
      <circle cx="49" cy="37" r="4.2" fill="#fff7e0" />
      <circle cx="71" cy="37" r="4.2" fill="#fff7e0" />
      <circle cx="49.5" cy="37" r="1.6" fill="#2a1810" stroke="none" />
      <circle cx="70.5" cy="37" r="1.6" fill="#2a1810" stroke="none" />
      <path d="M60 46 C80 46 93 56 93 70 C93 84 79 94 60 94 C41 94 27 84 27 70 C27 56 40 46 60 46 Z" fill="#d2432c" />
      <path d="M38 62 C44 54 52 51 60 51" fill="none" stroke="#f6a57f" strokeWidth="3.5" />
      <path d="M46 72 Q53 66 60 72 Q67 66 74 72" fill="none" strokeWidth="2" />
      <path d="M50 82 Q60 88 70 82" fill="none" strokeWidth="2" />
      <circle cx="42" cy="76" r="2" fill="#2a1810" stroke="none" />
      <circle cx="78" cy="76" r="2" fill="#2a1810" stroke="none" />
    </g>
  ),
  // Tôm
  () => (
    <g stroke="#2a1810" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
      <path d="M86 50 C110 40 110 12 66 8" fill="none" strokeWidth="2.2" />
      <path d="M88 55 C118 50 120 18 88 5" fill="none" strokeWidth="2.2" />
      <path d="M60.8 45.2 L54.8 56.0" fill="none" strokeWidth="2.4" />
      <path d="M52.3 44.1 L51.4 56.4" fill="none" strokeWidth="2.4" />
      <path d="M44.0 46.7 L48.4 58.2" fill="none" strokeWidth="2.4" />
      <path d="M37.6 52.5 L46.5 61.1" fill="none" strokeWidth="2.4" />
      <path d="M34.3 60.5 L46.0 64.6" fill="none" strokeWidth="2.4" />
      <ellipse cx="45.0" cy="91.6" rx="13" ry="5.5" fill="#f6a45c" transform="rotate(-8 45.0 91.6) translate(11 0)" />
      <ellipse cx="45.0" cy="91.6" rx="13" ry="5.5" fill="#f6a45c" transform="rotate(58 45.0 91.6) translate(11 0)" />
      <ellipse cx="45.0" cy="91.6" rx="13" ry="5.5" fill="#e8672e" transform="rotate(25 45.0 91.6) translate(11 0)" />
      <ellipse cx="37.8" cy="88.0" rx="7.0" ry="11" fill="#e8672e" transform="rotate(-236.0 37.8 88.0)" />
      <circle cx="36.0" cy="90.7" r="1.8" fill="#fbd3a0" stroke="none" />
      <ellipse cx="29.4" cy="79.4" rx="8.5" ry="11" fill="#ef7d3c" transform="rotate(-212.0 29.4 79.4)" />
      <circle cx="26.2" cy="81.4" r="1.8" fill="#fbd3a0" stroke="none" />
      <ellipse cx="25.2" cy="67.0" rx="10.0" ry="11" fill="#e8672e" transform="rotate(-186.0 25.2 67.0)" />
      <circle cx="20.7" cy="67.5" r="1.8" fill="#fbd3a0" stroke="none" />
      <ellipse cx="27.1" cy="53.1" rx="11.5" ry="11" fill="#ef7d3c" transform="rotate(-158.0 27.1 53.1)" />
      <circle cx="22.3" cy="51.2" r="1.8" fill="#fbd3a0" stroke="none" />
      <ellipse cx="35.4" cy="41.8" rx="12.5" ry="11" fill="#e8672e" transform="rotate(-130.0 35.4 41.8)" />
      <circle cx="31.7" cy="37.5" r="1.8" fill="#fbd3a0" stroke="none" />
      <ellipse cx="48.0" cy="35.6" rx="13.5" ry="11" fill="#ef7d3c" transform="rotate(-102.0 48.0 35.6)" />
      <circle cx="46.7" cy="29.7" r="1.8" fill="#fbd3a0" stroke="none" />
      <path d="M80.1 43.5 L101 66 L84 62 Z" fill="#c8372d" />
      <ellipse cx="68.1" cy="37.5" rx="17" ry="13.5" fill="#d9532a" transform="rotate(32 68.1 37.5)" />
      <path d="M58.1 32.5 q8 -4 14 2" fill="none" stroke="#fbd3a0" strokeWidth="3" />
      <circle cx="77.1" cy="38.5" r="4" fill="#fff7e0" />
      <circle cx="77.7" cy="38.9" r="1.7" fill="#2a1810" stroke="none" />
    </g>
  ),
  // Cá
  () => (
    <g stroke="#2a1810" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
      <path d="M86 61 C95 49 104 41 114 38 C109 52 109 70 114 86 C104 82 95 73 86 61 Z" fill="#e8a02e" />
      <path d="M98 52 L108 46 M97 61 L109 61 M98 70 L108 77" fill="none" strokeWidth="1.6" />
      <path d="M38 39 C46 22 68 22 78 45 Z" fill="#e8a02e" />
      <path d="M48 36 L52 28 M58 35 L60 26 M67 38 L69 30" fill="none" strokeWidth="1.6" />
      <path d="M46 84 C50 97 62 99 66 84 Z" fill="#e8a02e" />
      <path d="M12 62 C14 44 36 34 58 37 C74 39 86 49 92 61 C86 73 74 83 58 86 C36 90 14 80 12 62 Z" fill="#2f6fa8" />
      <path d="M22 50 C30 42 42 39 54 40" fill="none" stroke="#8cc4e6" strokeWidth="3.5" />
      <path d="M36 43 C44 54 44 70 36 82" fill="none" strokeWidth="2.4" />
      <path d="M51.0 50 q4.5 6 9 0 M60.0 50 q4.5 6 9 0 M69.0 50 q4.5 6 9 0 M46.5 58 q4.5 6 9 0 M55.5 58 q4.5 6 9 0 M64.5 58 q4.5 6 9 0 M73.5 58 q4.5 6 9 0 M82.5 58 q4.5 6 9 0 M42.0 66 q4.5 6 9 0 M51.0 66 q4.5 6 9 0 M60.0 66 q4.5 6 9 0 M69.0 66 q4.5 6 9 0 M78.0 66 q4.5 6 9 0 M55.5 74 q4.5 6 9 0 M64.5 74 q4.5 6 9 0 M73.5 74 q4.5 6 9 0" fill="none" stroke="#bfe0f2" strokeWidth="1.8" />
      <circle cx="25" cy="56" r="5.2" fill="#fff7e0" />
      <circle cx="24.4" cy="56.4" r="2.3" fill="#2a1810" stroke="none" />
      <path d="M12 64 q5 3 9 0" fill="none" strokeWidth="2" />
      <path d="M16 70 q-6 5 -3 12" fill="none" strokeWidth="2" />
      <path d="M56 62 C62 58 70 60 72 66 C66 72 58 70 56 62 Z" fill="#e8a02e" strokeWidth="2.2" />
    </g>
  ),
  // Gà
  () => (
    <g stroke="#2a1810" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
      <path d="M50 62 C26 54 14 34 22 12 C30 32 42 46 58 54 Z" fill="#27456e" />
      <path d="M50 66 C24 72 8 58 5 38 C18 54 34 60 54 58 Z" fill="#c8372d" />
      <path d="M50 72 C32 88 14 86 6 72 C22 78 36 74 54 64 Z" fill="#3f7d4a" />
      <path d="M62 92 L60 108 M60 108 L52 112 M60 108 L61 114 M60 108 L68 111" fill="none" stroke="#b8651b" strokeWidth="3.2" />
      <path d="M74 92 L77 108 M77 108 L69 112 M77 108 L79 114 M77 108 L86 110" fill="none" stroke="#b8651b" strokeWidth="3.2" />
      <path d="M42 74 C42 58 55 52 67 55 C72 44 77 35 84 31 C93 29 99 37 97 46 C95 58 92 71 86 81 C78 94 58 96 48 87 C44 83 42 79 42 74 Z" fill="#e3a32b" />
      <path d="M76 46 C74 52 74 58 76 64 M82 44 C80 51 80 58 83 64" fill="none" stroke="#c8372d" strokeWidth="2.6" />
      <path d="M50 70 C58 62 72 64 77 73 C71 84 57 84 50 70 Z" fill="#b8532a" />
      <path d="M56 71 q4 5 9 4 M62 68 q4 5 9 4" fill="none" strokeWidth="1.6" />
      <path d="M80 28 C76 19 83 15 87 21 C86 11 96 10 96 19 C101 13 108 18 103 27 Z" fill="#c8372d" />
      <path d="M98 34 L111 38 L98 42 Z" fill="#e8a02e" />
      <path d="M95 43 C100 47 100 56 94 56 C89 56 90 48 95 43 Z" fill="#c8372d" />
      <circle cx="91" cy="34" r="3.4" fill="#fff7e0" strokeWidth="2" />
      <circle cx="91.5" cy="34.2" r="1.4" fill="#2a1810" stroke="none" />
    </g>
  ),
  // Nai
  () => (
    <g stroke="#2a1810" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
      <path d="M40 78 L37 104 M49 80 L50 104 M76 80 L75 104 M85 78 L88 104" fill="none" strokeWidth="9.5" />
      <path d="M40 78 L37 104 M49 80 L50 104 M76 80 L75 104 M85 78 L88 104" fill="none" stroke="#b46a2c" strokeWidth="5.5" />
      <path d="M37 105 L37 109 M50 105 L50 109 M75 105 L75 109 M88 105 L88 109" fill="none" strokeWidth="7" />
      <path d="M30 60 C23 56 22 49 27 46" fill="none" strokeWidth="7" />
      <path d="M30 60 C23 56 22 49 27 46" fill="none" stroke="#f6ead0" strokeWidth="3.2" />
      <path d="M90 30 C87 21 88 13 92 6 M89 19 L81 13 M90 12 L97 9" fill="none" strokeWidth="3.4" />
      <path d="M98 30 C100 21 105 15 113 12 M102 20 L109 22 M106 15 L107 8" fill="none" strokeWidth="3.4" />
      <path d="M29 64 C29 53 39 48 52 50 L72 50 C76 44 80 37 84 32 C87 26 96 24 102 29 C108 33 110 39 106 43 L98 45 C96 53 94 60 92 66 C90 77 83 82 74 82 L46 82 C36 82 29 74 29 64 Z" fill="#b46a2c" />
      <path d="M86 29 C80 22 84 15 90 22 Z" fill="#d99a55" />
      <path d="M38 60 C42 54 50 53 58 54" fill="none" stroke="#e0a868" strokeWidth="3.5" />
      <path d="M92 66 C88 72 82 74 76 74" fill="none" stroke="#f6ead0" strokeWidth="3" opacity=".8" />
      <g fill="#f6ead0" stroke="none">
      <circle cx="44" cy="66" r="3" />
      <circle cx="54" cy="72" r="3" />
      <circle cx="63" cy="62" r="3" />
      <circle cx="72" cy="70" r="3" />
      <circle cx="53" cy="61" r="2.4" />
      <circle cx="80" cy="60" r="2.4" />
      </g>
      <circle cx="98" cy="33" r="2" fill="#2a1810" stroke="none" />
      <ellipse cx="106.5" cy="40" rx="2.6" ry="2" fill="#2a1810" stroke="none" />
    </g>
  ),
]

/** Linh vật thứ `sym` (0..5), vẽ trong ô `size` px. Đặt trong <svg> thì dùng `g`, đứng riêng thì tự bọc <svg>. */
export function BauCuaIcon({ sym, size = 48, g = false, x = 0, y = 0 }) {
  const Art = ART[sym]
  if (g) return <g transform={`translate(${x} ${y}) scale(${size / 120})`}><Art /></g>
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <Art />
    </svg>
  )
}
