import { useEffect, useRef, useState } from 'react'
import { Icon } from '#ds'
import { G, btn, field, mono } from '#components/games/stage.js'
import { t } from '#i18n'

const QUICK = ['games.room.quick1', 'games.room.quick2', 'games.room.quick3', 'games.room.quick4']

/**
 * Chat trong phòng (useGameRoom.say): tin tức thời, không lưu — chỉ ai đang mở phòng thấy. Tin hệ thống (`sys`: vào /
 * rời / sẵn sàng / đổi luật — useGameRoom tự suy từ thay đổi ghế) hiện thành viên thuốc nhỏ ở giữa (bản Phòng chờ v2).
 * `grow` = chiếm hết chiều cao khung cha, khung tin cuộn bên trong.
 */
export default function RoomChat({ g, nameOf, grow = false }) {
  const [text, setText] = useState('')
  const box = useRef(null)
  const send = (x) => { g.say(x); setText('') }
  // Tin mới → cuộn xuống cuối.
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight }, [g.chat.length])
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, ...(grow ? { flex: 1 } : null) }}>
      <div ref={box} style={{ display: 'flex', flexDirection: 'column', gap: 9, overflowY: 'auto', minHeight: 120, ...(grow ? { flex: 1 } : { maxHeight: 360 }) }} aria-live="polite">
        {g.chat.length === 0 && <span style={{ font: 'var(--type-caption)', color: G.muted, padding: '6px 0' }}>{t('games.room.chatEmpty')}</span>}
        {g.chat.map((m, i) => {
          if (m.sys) {
            const ok = m.sys.endsWith('Ready') || m.sys.endsWith('Join')
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'center' }}>
                <span style={{ maxWidth: '100%', padding: '4px 10px', borderRadius: 99, background: G.inset, font: '500 11.5px/1.3 var(--font-sans)', color: ok ? G.tealHi : G.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t(m.sys, { name: m.memberId ? nameOf(m.memberId) : '' })}
                </span>
              </div>
            )
          }
          const mine = m.memberId === g.me
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', gap: 3 }}>
              {!mine && <span style={{ ...mono, fontSize: 11 }}>{nameOf(m.memberId)}</span>}
              <span style={{
                maxWidth: '85%', padding: '8px 12px', borderRadius: 12, font: '400 13px/1.45 var(--font-sans)', overflowWrap: 'anywhere',
                background: mine ? G.teal : G.inset, color: mine ? G.tealInk : G.text,
              }}>{m.text}</span>
            </div>
          )
        })}
      </div>
      {g.me && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {QUICK.map((k) => (
              <button key={k} type="button" onClick={() => send(t(k))} style={{ ...btn('ghost', { sm: true }), padding: '5px 10px', borderRadius: 99, font: '500 12px/1 var(--font-sans)' }}>{t(k)}</button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) send(text) }} style={{ display: 'flex', gap: 6 }}>
            <input value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder={t('games.room.chatPh')} aria-label={t('games.room.chatPh')} style={{ ...field, flex: 1 }} />
            <button type="submit" disabled={!text.trim()} aria-label={t('games.room.send')} style={{ ...btn('primary', { sm: true }), opacity: text.trim() ? 1 : 0.45 }}><Icon name="send" size={15} /></button>
          </form>
        </>
      )}
    </div>
  )
}
