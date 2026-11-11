// Kiểu chung của mục Trò chơi (sảnh, BXH, phòng) — theo bản thiết kế "Tro choi - Redesign" (1a / 1c / 3a):
// tiêu đề + tab gạch chân, thẻ viền mảnh, nhãn mono viết hoa, ngọc lam = hành động, vàng = mục tiêu / xu.
// Màu đi theo token nên nền là theme chung của app (sáng / tối / sky) — chủ dự án chọn 2026-11-10.

const mix = (v, a) => `color-mix(in srgb, var(${v}) ${Math.round(a * 100)}%, transparent)`

export const G = {
  card: 'var(--surface-card)',
  inset: 'var(--surface-inset)',
  line: 'var(--border-subtle)',
  lineHi: 'var(--border-default)',
  text: 'var(--text-primary)',
  sub: 'var(--text-secondary)',
  soft: 'var(--text-secondary)',
  muted: 'var(--text-muted)',
  faint: 'var(--text-muted)',
  teal: 'var(--action-accent-bg)',
  tealHi: 'var(--text-accent)',
  tealInk: 'var(--action-accent-fg)',
  tealA: (a) => mix('--action-accent-bg', a),
  gold: 'var(--status-delayed)',
  goldHi: 'var(--status-delayed-fg)',
  goldA: (a) => mix('--status-delayed', a),
  red: 'var(--status-incident-fg)',
  redA: (a) => mix('--status-incident', a),
  silver: '#94a3b8',
  bronze: '#c2865a',
}

/** Khung cả màn: chỉ là lưới (nền là theme chung). */
export const stage = ({ mobile } = {}) => ({ display: 'grid', gap: mobile ? 16 : 22, gridTemplateColumns: 'minmax(0, 1fr)', minWidth: 0, color: G.text })

export const card = { borderRadius: 14, background: G.card, border: '1px solid ' + G.line, minWidth: 0 }
export const over = { font: '600 11px/1 var(--font-mono)', letterSpacing: '.12em', textTransform: 'uppercase', color: G.muted }
export const mono = { font: '400 12px/1.3 var(--font-mono)', color: G.muted }

/** Chip lọc tròn. */
export const chip = (on) => ({
  padding: '7px 14px', borderRadius: 99, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, font: '600 13px/1 var(--font-sans)',
  background: on ? G.tealA(0.16) : G.card, color: on ? G.tealHi : G.soft, border: '1px solid ' + (on ? G.tealA(0.45) : G.line),
})
/** Nút trong nhóm phân đoạn (Tuần / Tháng…). Bọc bằng `segWrap`. */
export const segWrap = { display: 'flex', gap: 4, padding: 4, borderRadius: 10, background: G.card, border: '1px solid ' + G.line, flexShrink: 0 }
export const seg = (on) => ({
  padding: '6px 12px', borderRadius: 7, border: 0, cursor: 'pointer', whiteSpace: 'nowrap', font: '600 13px/1 var(--font-sans)',
  background: on ? G.tealA(0.18) : 'transparent', color: on ? G.tealHi : G.muted,
})

/** Nút: primary (ngọc lam đặc), soft (ngọc lam nhạt), ghost (viền xám), danger (viền đỏ). */
export const btn = (kind = 'primary', { sm, block } = {}) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap',
  padding: sm ? '7px 12px' : '10px 16px', borderRadius: sm ? 9 : 10, font: `700 ${sm ? 13 : 14}px/1 var(--font-sans)`,
  width: block ? '100%' : undefined, minWidth: 0,
  ...(kind === 'primary' ? { background: G.teal, color: G.tealInk, border: '1px solid ' + G.teal }
    : kind === 'soft' ? { background: G.tealA(0.14), color: G.tealHi, border: '1px solid ' + G.tealA(0.4) }
      : kind === 'danger' ? { background: 'transparent', color: G.red, border: '1px solid ' + G.redA(0.35) }
        : { background: 'transparent', color: G.sub, border: '1px solid ' + G.lineHi }),
})
/** Ô nhập. */
export const field = {
  padding: '9px 12px', borderRadius: 10, background: G.card, border: '1px solid ' + G.lineHi, color: G.text,
  font: '400 13px/1.2 var(--font-sans)', minWidth: 0, outline: 'none',
}
/** Tab gạch chân ở đầu sảnh. */
export const tab = (on) => ({
  padding: '8px 12px', border: 0, background: 'none', cursor: 'pointer', whiteSpace: 'nowrap', font: `${on ? 700 : 500} 14px/1 var(--font-sans)`,
  color: on ? G.text : G.muted, borderBottom: '2px solid ' + (on ? G.teal : 'transparent'), marginBottom: -1,
})
/** Màu hạng 1 / 2 / 3 / còn lại. */
export const rankColor = (r) => (r === 1 ? G.goldHi : r === 2 ? G.silver : r === 3 ? G.bronze : G.muted)
