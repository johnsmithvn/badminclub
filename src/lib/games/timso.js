// Tìm số (chơi một mình, chạy hẳn trong trình duyệt — không server, không xu). 40 số rải trên bàn, chạm đúng theo thứ
// tự 1 → 40. Chế độ:
//   - race: đua với máy — ai chạm số đang cần trước thì ăn số đó (máy "tìm ra" sau BOT_MS ngẫu nhiên). Nhiều số hơn thắng.
//   - solo: một mình đua với đồng hồ, kỷ lục lưu trên máy.
// Chạm nhầm số chỉ rung lắc, không trừ gì. Để lâu (HINT_MS) không tìm ra thì số cần tìm phát sáng gợi ý (màn chơi lo).
// state = { mode, nums [{ n, x, y, fs, rot, ink }] (x / y % trên bàn), next, owner[n] ('me' | 'bot' | null), me, bot, over }

export const N = 40
export const COLS = 8
export const ROWS = 6
export const MODES = ['race', 'solo']
export const HINT_MS = 5000
/** Máy tìm ra số đang cần sau khoảng [min, max) ms. */
export const BOT_MS = [1700, 3600]
// Màu chữ số trên nền bàn tối (bản thiết kế) — bàn là "vật" nên viết cứng (DESIGN.md §2.4).
const INK = ['#E9EFF7', '#9FC0EA', '#F0B75C', '#C4B5FD', '#5FDBD3', '#FF9A8F']

/** Rải 40 số vào 40 trong 48 ô lưới 8 × 6, lệch ngẫu nhiên trong ô, cỡ chữ / góc nghiêng ngẫu nhiên. */
export function layout(rand = Math.random) {
  const slots = Array.from({ length: COLS * ROWS }, (_, i) => i)
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[slots[i], slots[j]] = [slots[j], slots[i]]
  }
  return slots.slice(0, N).map((slot, k) => ({
    n: k + 1,
    x: (((slot % COLS) + 0.5 + (rand() - 0.5) * 0.5) / COLS) * 100,
    y: ((Math.floor(slot / COLS) + 0.5 + (rand() - 0.5) * 0.45) / ROWS) * 100,
    fs: 26 + Math.floor(rand() * 16),
    rot: Math.round((rand() - 0.5) * 50),
    ink: INK[k % INK.length],
  }))
}

export const start = (mode, rand = Math.random) => ({
  mode: MODES.includes(mode) ? mode : 'race', nums: layout(rand), next: 1, owner: Array(N + 1).fill(null), me: 0, bot: 0, over: false,
})

/** `who` ('me' | 'bot') ăn số `n` — chỉ khi đúng số đang cần; sai thì trả nguyên state. */
export function claim(s, n, who) {
  if (s.over || n !== s.next || (who === 'bot' && s.mode !== 'race')) return s
  const owner = s.owner.slice()
  owner[n] = who
  return { ...s, owner, next: n + 1, me: s.me + (who === 'me' ? 1 : 0), bot: s.bot + (who === 'bot' ? 1 : 0), over: n === N }
}

/** Người chạm số `n` → { s, wrong } (wrong = chạm nhầm, chưa tới số đó). Số đã có chủ thì bỏ qua. */
export function tap(s, n) {
  if (s.over || s.owner[n]) return { s, wrong: false }
  if (n !== s.next) return { s, wrong: true }
  return { s: claim(s, n, 'me'), wrong: false }
}

/** Thời gian máy chờ trước khi ăn số đang cần. */
export const botDelay = (rand = Math.random) => BOT_MS[0] + rand() * (BOT_MS[1] - BOT_MS[0])

/** Kết quả khi hết ván: 'win' | 'lose' | 'draw' (race) hoặc 'done' (solo). */
export const outcome = (s) => (!s.over ? null : s.mode === 'solo' ? 'done' : s.me > s.bot ? 'win' : s.me < s.bot ? 'lose' : 'draw')
