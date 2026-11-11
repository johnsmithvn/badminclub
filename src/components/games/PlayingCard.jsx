import { t } from '#i18n'
import { CARD } from '#components/games/stage.js'
import { RANK_FACES, rankOf, SUIT_MARKS, suitOf } from '#lib/games/tienlen.js'

// Lá bài tây dùng chung cho các game bài (Tiến lên, Xì dách, Phỏm, Ba cây): lá c = hạng * 4 + chất. Hạng 0 là gì tuỳ game
// — `faces` = bảng tên hạng của game đó (mặc định Tiến lên: 3 … 2; Phỏm / Ba cây truyền RANK_FACES của phom.js: A … K).
// Vẽ theo bản thiết kế "Tien Len": mặt ngà, lưng sọc đỏ — là một "vật" nên viết cứng màu, giữ nguyên ở sáng / tối
// (DESIGN.md §2.4). Bảng màu `CARD` ở stage.js — Bài bịp (bộ Q/K/A/Joker riêng) dùng chung.

const radius = (w) => (w >= 70 ? 8 : w >= 40 ? 7 : 5)

/** Mặt lá phủ kín khung cha (position: relative). Lá to (≥ 56px) in góc như bài thật; lá nhỏ in giữa cho dễ đọc. */
export function CardFace({ c, w, h = Math.round(w * 1.42), faces = RANK_FACES }) {
  const suit = SUIT_MARKS[suitOf(c)]
  const box = {
    position: 'absolute', inset: 0, borderRadius: radius(w), background: CARD.face, border: '1px solid ' + CARD.line,
    color: suitOf(c) >= 2 ? CARD.red : CARD.black, pointerEvents: 'none',
  }
  if (w < 56) {
    return (
      <span style={{ ...box, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 1, font: `800 ${Math.max(10, Math.round(w * 0.36))}px/1 var(--font-sans)` }}>
        <span>{faces[rankOf(c)]}</span>
        <span style={{ fontWeight: 400 }}>{suit}</span>
      </span>
    )
  }
  const big = w >= 70
  return (
    <span style={box}>
      <span style={{ position: 'absolute', left: big ? 6 : 5, top: big ? 5 : 4, font: `800 ${big ? 19 : 17}px/1 var(--font-sans)`, letterSpacing: '-.04em' }}>{faces[rankOf(c)]}</span>
      <span style={{ position: 'absolute', left: big ? 7 : 6, top: big ? 26 : 23, font: `400 ${big ? 15 : 13}px/1 var(--font-sans)` }}>{suit}</span>
      <span style={{ position: 'absolute', right: big ? 7 : 6, bottom: big ? 7 : 6, font: `400 ${Math.round(h / 3.1)}px/1 var(--font-sans)` }}>{suit}</span>
    </span>
  )
}

/**
 * Một lá. `onPick` có thì là nút chọn được (nhô lên khi `on`); `back` = lá úp; `dim` = mờ (khoá);
 * `mark` = nhãn nhỏ góc trên (Phỏm: lá đã ăn); `pop` = lật mở (gameFlip); `label` thay nhãn đọc màn hình.
 */
export default function Card({ c, w = 42, faces = RANK_FACES, on, onPick, back, dim, mark, pop, label }) {
  const ring = on ? '0 0 0 2px var(--border-focus-color), var(--shadow-md)' : mark ? '0 0 0 2px var(--status-transit), var(--shadow-xs)' : 'var(--shadow-xs)'
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={!onPick}
      aria-pressed={onPick ? !!on : undefined}
      aria-label={label || (back ? t('games.cardBack') : faces[rankOf(c)] + SUIT_MARKS[suitOf(c)] + (mark ? ' · ' + mark : ''))}
      style={{
        position: 'relative', width: w, height: Math.round(w * 1.42), padding: 0, flexShrink: 0, borderRadius: radius(w),
        background: back ? CARD.back : 'none', border: back ? '2px solid ' + CARD.backLine : 0, boxShadow: ring,
        opacity: dim ? 0.45 : 1, transform: on ? 'translateY(-10px)' : 'none',
        transition: 'transform var(--dur-fast) var(--ease-standard), opacity var(--dur-fast)',
        animation: pop ? 'gameFlip var(--dur-slow) var(--ease-standard) both' : 'none',
        cursor: onPick ? 'pointer' : 'default', touchAction: 'manipulation',
      }}
    >
      {!back && <CardFace c={c} w={w} faces={faces} />}
      {mark && !back && w >= 30 && (
        <span aria-hidden="true" style={{
          position: 'absolute', top: -7, right: -7, padding: '2px 4px', borderRadius: 99, font: '600 9px/1 var(--font-sans)',
          background: 'var(--status-transit-bg)', color: 'var(--status-transit-fg)', border: '1px solid var(--status-transit)',
        }}>{mark}</span>
      )}
    </button>
  )
}
