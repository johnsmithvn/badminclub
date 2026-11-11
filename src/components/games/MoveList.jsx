import { useEffect, useRef } from 'react'
import { G } from '#components/games/stage.js'
import { t } from '#i18n'

/**
 * Tab Nước đi của Cờ vua / Cờ tướng (bản thiết kế): mỗi dòng một cặp nước "số. bên đi trước · bên đi sau", nước mới
 * nhất tô ngọc lam. `list` = ký hiệu từng nước theo thứ tự (registry.notesOf / BotRoom tự ghi).
 */
export default function MoveList({ list }) {
  const box = useRef(null)
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight }, [list.length])
  if (!list.length) return <span style={{ font: 'var(--type-caption)', color: G.muted, padding: '18px 8px', textAlign: 'center', display: 'block', lineHeight: 1.6 }}>{t('games.room.noMovesHint')}</span>
  const last = list.length - 1
  const cell = (k) => ({
    font: '500 13.5px/1 var(--font-mono)', padding: '6px 8px', borderRadius: 6, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    background: last === k ? G.tealA(0.18) : 'transparent', color: last === k ? G.tealHi : G.text,
  })
  return (
    <div ref={box} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', overflowY: 'auto', minHeight: 0, flex: 1, alignContent: 'start' }}>
      {Array.from({ length: Math.ceil(list.length / 2) }, (_, n) => (
        <div key={n} style={{ display: 'grid', gridTemplateColumns: '34px minmax(0, 1fr) minmax(0, 1fr)', gap: 6, alignItems: 'center', padding: '2px 4px', borderRadius: 8, background: n % 2 ? G.inset : 'transparent' }}>
          <span style={{ font: '400 12px/1 var(--font-mono)', color: G.muted }}>{n + 1}.</span>
          <span style={cell(n * 2)}>{list[n * 2]}</span>
          <span style={cell(n * 2 + 1)}>{list[n * 2 + 1] || ''}</span>
        </div>
      ))}
    </div>
  )
}
