import { t } from '#i18n'
import { faceOf, RANK_FACES, rankOf, SUIT_MARKS, suitOf } from '#lib/games/tienlen.js'

// Lá bài tây dùng chung cho các game bài (Tiến lên, Xì dách, Phỏm): lá c = hạng * 4 + chất như lib/games/tienlen.js.
// `onPick` có thì là nút chọn được (nhô lên khi `on`); `back` = lá úp (không lộ mặt).
const RED = 'var(--status-incident-fg)'

export default function Card({ c, on, small, onPick, back }) {
  const w = small ? 30 : 42
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={!onPick}
      aria-pressed={onPick ? !!on : undefined}
      aria-label={back ? t('games.cardBack') : faceOf(c)}
      style={{
        width: w, height: Math.round(w * 1.42), padding: 0, flexShrink: 0, borderRadius: small ? 5 : 7,
        display: 'grid', placeItems: 'center', alignContent: 'center', gap: 1,
        background: back ? 'repeating-linear-gradient(45deg, var(--navy-400) 0 4px, var(--navy-600, var(--navy-400)) 4px 8px)' : 'var(--surface-card)',
        color: back ? 'transparent' : suitOf(c) >= 2 ? RED : 'var(--text-primary)',
        border: '1.5px solid ' + (on ? 'var(--border-focus-color)' : back ? 'var(--gray-0)' : 'var(--border-default)'),
        boxShadow: on ? 'var(--shadow-md)' : 'var(--shadow-xs)',
        transform: on ? 'translateY(-10px)' : 'none', transition: 'transform var(--dur-fast) var(--ease-standard)',
        font: (small ? '600 12px' : '600 15px') + '/1 var(--font-mono)', cursor: onPick ? 'pointer' : 'default',
        opacity: 1, touchAction: 'manipulation',
      }}
    >
      {!back && <span>{RANK_FACES[rankOf(c)]}</span>}
      {!back && <span style={{ fontSize: small ? 12 : 16 }}>{SUIT_MARKS[suitOf(c)]}</span>}
    </button>
  )
}
