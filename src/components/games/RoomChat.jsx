import { useEffect, useRef, useState } from 'react'
import { Icon } from '#ds'
import { G, btn, field, mono } from '#components/games/stage.js'
import { STICKERS, stickerOf, stickerText } from '#components/games/characters.js'
import { t } from '#i18n'

const QUICK = ['games.room.quick1', 'games.room.quick2', 'games.room.quick3', 'games.room.quick4']
const BUBBLE_MS = 3000 // bong bóng trên thanh người chơi tự tắt sau ngần này

/**
 * Tin chat mới nhất của từng người trong BUBBLE_MS vừa qua → { [memberId]: { text, at } } — bong bóng trên thanh người
 * chơi (ChessStage). Tin hệ thống không tính. Hết giờ thì hẹn giờ đánh dấu tin đó đã tắt.
 */
export function useBubbles(chat) {
  const [gone, setGone] = useState({}) // memberId → `at` của tin đã tắt
  const last = {}
  for (const m of chat) if (!m.sys && m.memberId) last[m.memberId] = m
  const live = Object.values(last).filter((m) => gone[m.memberId] !== m.at)
  const key = live.map((m) => m.memberId + m.at).join()
  useEffect(() => {
    const ids = live.map((m) => setTimeout(() => setGone((g) => ({ ...g, [m.memberId]: m.at })), Math.max(0, m.at + BUBBLE_MS - Date.now())))
    return () => ids.forEach(clearTimeout)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps -- `live` suy từ `key`
  return Object.fromEntries(live.map((m) => [m.memberId, m]))
}

/**
 * Chat trong phòng (useGameRoom.say): tin tức thời, không lưu — chỉ ai đang mở phòng thấy. Tin hệ thống (`sys`: vào /
 * rời / sẵn sàng / đổi luật — useGameRoom tự suy từ thay đổi ghế) hiện thành viên thuốc nhỏ ở giữa (bản Phòng chờ v2).
 * `grow` = chiếm hết chiều cao khung cha, khung tin cuộn bên trong.
 * `dock` (điện thoại, bản "Cờ · sinh động"): bỏ khung tin — chỉ còn câu nhanh (cuộn ngang) + ô nhắn + dòng tin mới nhất;
 * `onRoom` thêm nút "Phòng" mở tấm trượt chứa đủ tab (chat / nước đi / người xem).
 */
export default function RoomChat({ g, nameOf, grow = false, dock = false, onRoom }) {
  const [text, setText] = useState('')
  const [tray, setTray] = useState(false) // khay sticker đang mở
  const box = useRef(null)
  const send = (x) => { g.say(x); setText(''); setTray(false) }
  // Tin mới → cuộn xuống cuối.
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight }, [g.chat.length])
  const lastMsg = dock ? [...g.chat].reverse().find((m) => !m.sys) : null
  const roomBtn = onRoom && (
    <button type="button" onClick={onRoom} aria-label={t('games.room.openPanel')} title={t('games.room.openPanel')}
      style={{ ...btn('soft', { sm: true }), padding: '7px 10px', flexShrink: 0 }}><Icon name="message-circle" size={15} />{t('games.room.panelShort')}</button>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: dock ? 8 : 10, minHeight: 0, ...(grow ? { flex: 1 } : null) }}>
      {!dock && <div ref={box} style={{ display: 'flex', flexDirection: 'column', gap: 9, overflowY: 'auto', minHeight: 120, ...(grow ? { flex: 1 } : { maxHeight: 360 }) }} aria-live="polite">
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
          const stk = stickerOf(m.text)
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', gap: 3 }}>
              {!mine && <span style={{ ...mono, fontSize: 11 }}>{nameOf(m.memberId)}</span>}
              {stk ? <img src={STICKERS[stk].src} alt={t('games.room.stk.' + stk)} title={t('games.room.stk.' + stk)} style={{ width: 64, height: 64 }} /> : (
                <span style={{
                  maxWidth: '85%', padding: '8px 12px', borderRadius: 12, font: '400 13px/1.45 var(--font-sans)', overflowWrap: 'anywhere',
                  background: mine ? G.teal : G.inset, color: mine ? G.tealInk : G.text,
                }}>{m.text}</span>
              )}
            </div>
          )
        })}
      </div>}
      {!g.me && roomBtn}
      {g.me && (
        <>
          <div style={{ display: 'flex', gap: 6, ...(dock ? { overflowX: 'auto', scrollbarWidth: 'none' } : { flexWrap: 'wrap' }) }}>
            {QUICK.map((k) => (
              <button key={k} type="button" onClick={() => send(t(k))} style={{ ...btn('ghost', { sm: true }), padding: '5px 10px', borderRadius: 99, font: '500 12px/1 var(--font-sans)', flexShrink: 0 }}>{t(k)}</button>
            ))}
          </div>
          {tray && (
            <div role="group" aria-label={t('games.room.stickers')} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 4, padding: 6, borderRadius: 12, background: G.inset }}>
              {Object.entries(STICKERS).map(([id, s]) => (
                <button key={id} type="button" onClick={() => send(stickerText(id))} title={t('games.room.stk.' + id)} aria-label={t('games.room.stk.' + id)}
                  style={{ display: 'grid', placeItems: 'center', padding: 4, border: 0, borderRadius: 10, background: 'transparent', cursor: 'pointer' }}>
                  <img src={s.src} alt="" style={{ width: 48, height: 48 }} />
                </button>
              ))}
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) send(text) }} style={{ display: 'flex', gap: 6 }}>
            {roomBtn}
            <button type="button" aria-pressed={tray} aria-label={t('games.room.stickers')} title={t('games.room.stickers')} onClick={() => setTray(!tray)}
              style={{ ...btn(tray ? 'soft' : 'ghost', { sm: true }), padding: '7px 9px' }}><Icon name="smile" size={16} /></button>
            <input value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder={t('games.room.chatPh')} aria-label={t('games.room.chatPh')} style={{ ...field, flex: 1 }} />
            <button type="submit" disabled={!text.trim()} aria-label={t('games.room.send')} style={{ ...btn('primary', { sm: true }), opacity: text.trim() ? 1 : 0.45 }}><Icon name="send" size={15} /></button>
          </form>
        </>
      )}
      {dock && (
        <span style={{ font: '400 11.5px/1.3 var(--font-sans)', color: G.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 4px' }}>
          {lastMsg
            ? t('games.room.lastLine', { name: lastMsg.memberId === g.me ? t('games.bot.you') : nameOf(lastMsg.memberId), text: stickerOf(lastMsg.text) ? t('games.room.lastSticker') : lastMsg.text })
            : t('games.room.lastNone')}
        </span>
      )}
    </div>
  )
}
