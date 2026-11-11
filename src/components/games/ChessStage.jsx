import { useState } from 'react'
import { Icon } from '#ds'
import { G, btn, card, mono } from '#components/games/stage.js'
import { SKINS, setSkin, useSkin } from '#components/games/chessSkins.js'
import { mmss, rnd, useFit } from '#components/games/chessUi.js'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'

// Sân khấu chung của bàn Cờ vua / Cờ tướng (bản thiết kế "Co Vua" / "Co Tuong"):
//   thanh đối thủ (ô ký hiệu, tên, quân đã ăn + điểm hơn, trạng thái, đồng hồ)
//   cột cán cân lực lượng + khung bàn viền vàng đính ngọc ở bốn góc (bàn vẽ ở cỡ thiết kế rồi co cho vừa màn hình)
//   thanh của mình · lời xin hoà · lưới nút (Đi lại / Gợi ý / Xin hoà / Xin thua — phòng truyền `actions`).
// Bàn và hiệu ứng mang màu skin (viết cứng — chessSkins.js); thanh người chơi và nút đi theo token của app.
// CoVuaBoard / CoTuongBoard vẽ ô + quân làm `children`; lớp hiệu ứng dùng chung là <ChessFx>.

const LOW_MS = 20000 // dưới ngần này đồng hồ chuyển đỏ

function Bar({ p, active }) {
  const low = p.clock != null && active && p.clock <= LOW_MS
  return (
    <div style={{
      ...card, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px',
      background: active ? G.tealA(0.08) : G.card, borderColor: active ? G.tealA(0.5) : G.line,
    }} aria-live={p.me ? 'polite' : undefined}>
      {p.mark}
      <div style={{ display: 'grid', gap: 3, flex: 1, minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' }}>
        <span style={{ font: '700 15px/1.2 var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {p.name}{p.tag && <span style={{ fontWeight: 400, color: G.muted, fontSize: 12 }}> {p.tag}</span>}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, minHeight: 20, flexWrap: 'wrap' }}>
          {p.caps}
          {p.adv > 0 && <span style={{ ...mono, marginLeft: 6 }}>+{p.adv}</span>}
        </div>
      </div>
      {p.status && <span style={{ font: '600 12.5px/1.2 var(--font-sans)', color: p.alert ? G.red : G.tealHi, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flexShrink: 1 }}>{p.status}</span>}
      {p.clock != null && (
        <span role="timer" style={{
          padding: '6px 13px', borderRadius: 9, font: '700 21px/1 var(--font-mono)', flexShrink: 0,
          background: !active ? G.inset : low ? G.red : G.teal, color: !active ? G.muted : low ? '#fff' : G.tealInk,
        }}>{mmss(p.clock)}</span>
      )}
    </div>
  )
}

/**
 * `sk` skin · `box` { w, h, pad, radius } cỡ thiết kế của mặt bàn và lề khung · `top` / `bottom` thanh người chơi
 * { mark (ô ký hiệu), name, tag, caps, adv, status, alert, clock (ms | null), me } · `turnTop` / `turnBottom` ai đang tới lượt ·
 * `evalPct` 0–100 phần của người ngồi dưới · `over` { title, sub } | null · `overActions` / `actions`
 * [{ key, icon, label, on, off, danger, soft }] · `offer` { text, answer? (đồng ý: boolean) → void }.
 */
export default function ChessStage({ sk, box, top, bottom, turnTop, turnBottom, evalPct, over, overActions, actions, offer, children }) {
  const isMobile = useMobile(768)
  const DW = box.w + box.pad * 2 + 4 + (evalPct == null ? 0 : 26)
  const DH = box.h + box.pad * 2 + 4
  const [ref, k] = useFit(DW)
  // Màn kết thúc che bàn — cho gấp lại để xem thế cờ cuối; ván mới (over đổi) thì hiện lại.
  const [peek, setPeek] = useState(null)
  const hidden = peek === over?.title + over?.sub
  const gem = (pos) => <span aria-hidden="true" style={{ position: 'absolute', ...pos, width: 16, height: 16, transform: 'rotate(45deg)', background: sk.acc, boxShadow: '0 0 12px ' + sk.acc }} />

  return (
    <div ref={ref} style={{ width: '100%', maxWidth: DW, margin: '0 auto', display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <Bar p={top} active={turnTop} />
      <div style={{ height: DH * k, position: 'relative', background: `radial-gradient(closest-side, ${sk.page}, transparent)` }}>
        <div data-game-fx style={{ width: DW, height: DH, transform: `scale(${k})`, transformOrigin: '0 0', display: 'flex', alignItems: 'stretch', gap: 14 }}>
          {evalPct != null && (
            <div title={t('games.chess.balance')} style={{ width: 12, borderRadius: 6, background: 'rgba(0,0,0,.45)', border: '1px solid rgba(148,163,184,.25)', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: evalPct + '%', background: `linear-gradient(0deg, ${sk.acc}, rgba(255,255,255,.85))`, boxShadow: '0 0 12px ' + sk.acc, transition: 'height .6s cubic-bezier(.3,.7,.2,1)' }} />
            </div>
          )}
          <div style={{
            position: 'relative', padding: box.pad, borderRadius: 22, background: sk.frame, border: '2px solid ' + sk.border,
            boxShadow: `0 30px 70px -30px rgba(0,0,0,.8), 0 0 50px -12px rgba(${sk.rgb},.35), inset 0 0 0 6px rgba(0,0,0,.25)`,
          }}>
            {gem({ left: -9, top: -9 })}{gem({ right: -9, top: -9 })}{gem({ left: -9, bottom: -9 })}{gem({ right: -9, bottom: -9 })}
            <div style={{ position: 'relative', width: box.w, height: box.h, userSelect: 'none', touchAction: 'manipulation' }}>
              {children}
              {over && !hidden && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 20, borderRadius: box.radius, background: 'rgba(5,6,16,.74)', backdropFilter: 'blur(3px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center' }}>
                  <div style={{ font: 'italic 700 50px/1.1 var(--font-display)', color: sk.acc, textShadow: '0 0 30px ' + sk.acc }}>{over.title}</div>
                  {over.sub && <div style={{ font: '400 17px/1.4 var(--font-sans)', color: '#e6edf7', maxWidth: 420 }}>{over.sub}</div>}
                  <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {(overActions || []).map((x, i) => (
                      <button key={x.key} type="button" onClick={x.on} style={{
                        padding: '12px 22px', borderRadius: 12, font: `${i ? 600 : 800} 16px/1 var(--font-sans)`, cursor: 'pointer',
                        ...(i ? { background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,.3)' } : { background: sk.acc, color: '#1a1200', border: '1px solid ' + sk.acc }),
                      }}>{x.label}</button>
                    ))}
                    <button type="button" onClick={() => setPeek(over.title + over.sub)} style={{ padding: '12px 18px', borderRadius: 12, font: '600 16px/1 var(--font-sans)', cursor: 'pointer', background: 'transparent', color: '#cbd5e1', border: '1px solid rgba(255,255,255,.2)' }}>{t('games.chess.viewBoard')}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Bar p={bottom} active={turnBottom} />

      {offer && (
        <div style={{ ...card, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', flexWrap: 'wrap', borderColor: G.goldA(0.45), background: G.goldA(0.08) }} role="status">
          <Icon name="handshake" size={16} />
          <span style={{ font: '600 13px/1.3 var(--font-sans)', flex: 1, minWidth: 0 }}>{offer.text}</span>
          {offer.answer && (
            <>
              <button type="button" onClick={() => offer.answer(true)} style={btn('primary', { sm: true })}>{t('games.chess.accept')}</button>
              <button type="button" onClick={() => offer.answer(false)} style={btn('ghost', { sm: true })}>{t('games.chess.decline')}</button>
            </>
          )}
        </div>
      )}

      {actions?.length > 0 && (
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: `repeat(${actions.length}, minmax(0, 1fr))` }}>
          {actions.map((x) => (
            <button key={x.key} type="button" disabled={x.off} onClick={x.on} title={x.label} aria-label={x.label}
              style={{ ...btn(x.danger ? 'danger' : x.soft ? 'soft' : 'ghost'), padding: '11px 8px', font: '600 13px/1 var(--font-sans)', opacity: x.off ? 0.45 : 1, cursor: x.off ? 'default' : 'pointer' }}>
              <Icon name={x.icon} size={15} />{!isMobile && x.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Lớp hiệu ứng phủ trên mặt bàn (không bắt chuột). Mọi thứ suy từ thế cờ hiện tại, gắn key theo `ply` nên mỗi nước
 * mới tự diễn lại: vệt nước đi · gợn sóng ô đến · chớp + mảnh bung + hồn quân khi ăn · cột sáng phong cấp · chữ CHIẾU!
 * Luôn có: bụi sáng bay, hào quang quân bị chiếu, vòng chọn quay, mũi tên gợi ý.
 *   `at(i)` tâm ô / điểm i (px thiết kế) · `cell` cạnh ô · `last` { from, to } · `cap` { colors, node } quân vừa bị ăn ·
 *   `promo` vừa phong cấp · `check` ô vua bị chiếu · `banner` { text, mate } · `sel` ô đang chọn · `hint` { from, to }.
 */
export function ChessFx({ sk, w, h, at, cell, ply, last, cap, promo, check, banner, sel, hint, motes = true }) {
  const kids = []
  const ink = sk.blend === 'multiply' // skin Mực tàu: hiệu ứng mực, không phát sáng
  if (motes) {
    for (let j = 0; j < 16; j++) {
      const sz = 2 + rnd(j * 3) * 3
      kids.push(<span key={'m' + j} style={{ position: 'absolute', left: rnd(j) * w, top: h * 0.3 + rnd(j * 5) * h * 0.68, width: sz, height: sz, borderRadius: '50%', background: sk.acc, boxShadow: '0 0 8px ' + sk.acc, opacity: 0, animation: `chMote ${7 + rnd(j * 7) * 6}s linear ${rnd(j * 11) * 7}s infinite` }} />)
    }
  }
  if (check != null) {
    const c = at(check)
    kids.push(<div key={'aura' + check} style={{ position: 'absolute', left: c.x, top: c.y, width: cell * 1.5, height: cell * 1.5, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,70,90,.8), rgba(255,0,60,.3) 50%, transparent 70%)', animation: 'chAura 1.1s ease-in-out infinite' }} />)
  }
  if (sel != null) {
    const c = at(sel)
    kids.push(<div key="sel" style={{ position: 'absolute', left: c.x, top: c.y, width: cell * 0.95, height: cell * 0.95, borderRadius: '50%', border: '2px dashed ' + sk.acc, boxShadow: `0 0 18px rgba(${sk.rgb},.7), inset 0 0 14px rgba(${sk.rgb},.5)`, animation: 'chSpin 6s linear infinite' }} />)
  }
  if (hint) {
    const a = at(hint.from)
    const b = at(hint.to)
    const ang = Math.atan2(b.y - a.y, b.x - a.x)
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    kids.push(<div key="hint" style={{ position: 'absolute', left: a.x, top: a.y - 4, width: Math.max(0, len - 14), height: 8, borderRadius: 4, background: `linear-gradient(90deg, rgba(${sk.rgb},.15), rgba(${sk.rgb},.95))`, boxShadow: `0 0 14px rgba(${sk.rgb},.8)`, transformOrigin: '0 50%', transform: `rotate(${ang}rad)`, animation: 'chHint 1.2s ease-in-out infinite', zIndex: 3 }} />)
    kids.push(
      <div key="hintHead" style={{ position: 'absolute', left: b.x - 13, top: b.y - 13, width: 26, height: 26, transform: `rotate(${ang}rad)`, zIndex: 3 }}>
        <div style={{ width: 0, height: 0, borderTop: '13px solid transparent', borderBottom: '13px solid transparent', borderLeft: '22px solid ' + sk.acc, filter: `drop-shadow(0 0 8px ${sk.acc})`, animation: 'chHint 1.2s ease-in-out infinite' }} />
      </div>,
    )
  }
  if (last) {
    const a = at(last.from)
    const b = at(last.to)
    const k = 'p' + ply
    kids.push(<div key={k + 'st'} style={{ position: 'absolute', left: a.x, top: a.y - 3, width: Math.hypot(b.x - a.x, b.y - a.y), height: 6, borderRadius: 3, background: `linear-gradient(90deg, rgba(${sk.rgb},0), rgba(${sk.rgb},.9))`, boxShadow: `0 0 16px rgba(${sk.rgb},.8)`, transformOrigin: '0 50%', transform: `rotate(${Math.atan2(b.y - a.y, b.x - a.x)}rad)`, animation: 'chStreak .6s ease-out forwards', zIndex: 4 }} />)
    kids.push(<div key={k + 'land'} style={{ position: 'absolute', left: b.x, top: b.y, width: cell * 1.14, height: cell * 1.14, borderRadius: '50%', border: '2px solid ' + sk.acc, boxShadow: `0 0 16px rgba(${sk.rgb},.7)`, opacity: 0, animation: 'chRipple .75s ease-out .32s forwards', zIndex: 5 }} />)
    if (promo) kids.push(<div key={k + 'beam'} style={{ position: 'absolute', left: b.x - cell / 2 + 6, top: b.y - cell / 2 - 260, width: cell - 12, height: cell + 260, background: `linear-gradient(0deg, rgba(${sk.rgb},.9), rgba(${sk.rgb},0))`, transformOrigin: '50% 100%', filter: 'blur(2px)', opacity: 0, animation: 'chBeam 1.4s ease-out .3s forwards', zIndex: 7, mixBlendMode: 'screen' }} />)
    if (cap) {
      const cols = cap.colors
      kids.push(<div key={k + 'flash'} style={{ position: 'absolute', left: b.x, top: b.y, width: 150, height: 150, borderRadius: '50%', background: ink ? `radial-gradient(circle, ${cols[0]}, rgba(0,0,0,.25) 35%, transparent 65%)` : `radial-gradient(circle, #fff, ${cols[0]} 25%, transparent 65%)`, opacity: 0, animation: 'chFlash .55s ease-out .28s forwards', zIndex: 7, mixBlendMode: ink ? 'multiply' : 'screen' }} />)
      for (let j = 0; j < 22; j++) {
        const ang = (j / 22) * Math.PI * 2 + rnd(j * 3.3) * 0.5
        const dist = 48 + rnd(j * 7.1) * 80
        const sz = 4 + rnd(j * 2.2) * 6
        const col = cols[j % 3]
        kids.push(<span key={k + 'b' + j} style={{
          position: 'absolute', left: b.x, top: b.y, width: sz, height: ink ? sz : sz * 1.6, borderRadius: ink ? '50%' : 0, background: col,
          clipPath: ink ? 'none' : 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)', boxShadow: ink ? 'none' : '0 0 8px ' + col,
          '--dx': Math.cos(ang) * dist + 'px', '--dy': Math.sin(ang) * dist + 'px', opacity: 0,
          animation: `chBurst ${0.9 + rnd(j) * 0.5}s cubic-bezier(.15,.7,.3,1) .28s forwards`, zIndex: 7,
        }} />)
      }
      kids.push(<div key={k + 'soul'} style={{ position: 'absolute', left: b.x - cell / 2, top: b.y - cell / 2, width: cell, height: cell, display: 'grid', placeItems: 'center', opacity: 0, animation: 'chSoul 1.4s ease-out .26s forwards', zIndex: 7, filter: `drop-shadow(0 0 12px ${cols[0]})` }}>{cap.node}</div>)
    }
    if (banner) {
      kids.push(<div key={k + 'banner'} style={{
        position: 'absolute', left: '50%', top: '50%', zIndex: 8, font: `italic 700 ${banner.mate ? 76 : 66}px/1 var(--font-display)`, letterSpacing: '.04em', whiteSpace: 'nowrap',
        color: banner.mate ? sk.acc : '#ff6b81', textShadow: `0 0 30px ${banner.mate ? sk.acc : 'rgba(255,60,90,.9)'}, 0 4px 0 rgba(0,0,0,.5)`, opacity: 0, animation: 'chBanner 1.5s ease-out .35s forwards',
      }}>{banner.text}</div>)
    }
  }
  return <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>{kids}</div>
}

/** Hàng chọn skin bàn (đầu trang phòng cờ) — nhớ theo máy. `kind` = 'covua' | 'cotuong'. */
export function SkinPicker({ kind }) {
  const [cur] = useSkin(kind)
  const isMobile = useMobile(768)
  return (
    <div role="group" aria-label={t('games.skin.label')} style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 12, background: G.card, border: '1px solid ' + G.line, flexShrink: 0 }}>
      {Object.entries(SKINS[kind]).map(([id, v]) => (
        <button key={id} type="button" aria-pressed={cur === id} title={t('games.skin.' + id)} aria-label={t('games.skin.' + id)} onClick={() => setSkin(kind, id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: isMobile ? 7 : '6px 11px', borderRadius: 9, border: 0, cursor: 'pointer', whiteSpace: 'nowrap', font: '600 13px/1 var(--font-sans)',
            background: cur === id ? G.tealA(0.16) : 'transparent', color: cur === id ? G.tealHi : G.soft,
          }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: v.sw, boxShadow: '0 0 0 1px ' + G.lineHi }} />
          {!isMobile && t('games.skin.' + id)}
        </button>
      ))}
    </div>
  )
}
