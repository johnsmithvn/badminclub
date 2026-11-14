import { useState } from 'react'
import { t } from '#i18n'
import { colorOf, movesFrom, PROMOS, typeOf } from '#lib/games/covua.js'
import { useSkin } from '#components/games/chessSkins.js'
import { overOf, useChessClock } from '#components/games/chessUi.js'
import ChessStage, { ChessFx } from '#components/games/ChessStage.jsx'
import CutScene, { MateCage, useCloseUp } from '#components/games/CutScene.jsx'
import { CHESS_ART } from '#components/games/characters.js'

// Bàn Cờ vua (bản thiết kế "Co Vua" + "Cờ · sinh động"): 4 skin chọn được (chessSkins.js — Sinh động / Huyền bí / Băng giá /
// Rừng cổ), khung và hiệu ứng ở ChessStage. Ô là lưới 8 × 8 cỡ thiết kế 74px (ChessStage co cho vừa màn hình). Skin có
// `art` vẽ quân nhân vật (Mặt Trời / Mặt Trăng — characters.js, đầu quân nhô lên ô trên, không bắt chuột); skin khác vẽ
// ký hiệu cờ (Unicode) tô chuyển màu. Ghế 1 (quân đen) thấy bàn xoay 180° để quân mình luôn ở dưới.
// Chạm quân → chấm ô đi được → chạm ô. Tốt lên hàng cuối thì hiện bảng chọn quân phong ngay trên bàn.
// Thanh người chơi: quân đã ăn (suy từ số quân còn trên bàn) + điểm hơn; cột cán cân theo tổng giá trị quân; bong bóng chat.
// Hiệu ứng theo nước vừa đi: nhãn Nhập thành / Thăng cấp / Hồi sinh (phong lại quân đã mất), lồng chiếu hết úp vua;
// bật Cận cảnh thì ăn quân diễn cảnh đấu theo kiểu đòn từng quân, phong cấp diễn cảnh thăng cấp (CutScene).
// Đồng hồ tổng + xin hoà: lib/games/chessClock.js. `hint` { from, to } (phòng máy) vẽ mũi tên gợi ý.
// Luật: lib/games/covua.js.
// ponytail: skin ký hiệu dùng font hệ thống — đổi sang SVG path riêng nếu máy nào hiện xấu.

const S = 74 // cạnh một ô (px thiết kế)
const BOX = { w: S * 8, h: S * 8, pad: 20, radius: 6 }
// ︎ (U+FE0E): ép hiện dạng chữ (không phải emoji) trên iOS / Android.
const GLYPH = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' }
const FONT = "'Segoe UI Symbol', 'DejaVu Sans', 'Noto Sans Symbols 2', 'Apple Symbols', sans-serif"
const VAL = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 }
const FULL = { Q: 1, R: 2, B: 2, N: 2, P: 8 } // số quân lúc đầu ván (thứ tự hiện: quân to trước)
const FILES = 'abcdefgh'
// Cận cảnh: kiểu đòn từng quân · chất liệu lồng chiếu hết theo quân chiếu (vua chiếu thì như xe).
const BLOW = { P: 'thrust', N: 'leap', B: 'stomp', R: 'charge', Q: 'beam', K: 'slash' }
const MAT = { Q: 'light', R: 'stone', N: 'wood', B: 'vine', P: 'rope' }
const COL = ['#ffcf3a', '#9fb0ff']
const BAND = [
  'linear-gradient(100deg,rgba(60,30,4,.96),rgba(120,64,10,.94) 55%,rgba(30,22,60,.96))',
  'linear-gradient(100deg,rgba(10,14,48,.97),rgba(40,40,110,.95) 55%,rgba(60,30,8,.95))',
]
const CUT = 1.7 // giây một cảnh đấu — cảnh sau chờ cảnh trước
const L = (k, o) => t('games.covua.live.' + k, o)

export default function CoVuaBoard({ state, mySeat, canMove, onMove, result, names, tags, note, actions, overActions, hint, bubbles }) {
  const [, sk] = useSkin('covua')
  const closeUp = useCloseUp()
  const [picked, setPicked] = useState(null)
  const [promo, setPromo] = useState(null) // { ply, from, to } — đang chờ chọn quân phong
  const clocks = useChessClock(state, mySeat, onMove)
  const me = mySeat === 1 ? 1 : 0 // ghế ngồi phía dưới (người xem nhìn từ phía Trắng)
  const foe = 1 - me
  const disp = (i) => (me === 1 ? 63 - i : i)
  const at = (i) => ({ x: (disp(i) & 7) * S + S / 2, y: (disp(i) >> 3) * S + S / 2 })
  const mine = (i) => canMove && colorOf(state.board[i]) === mySeat
  const sel = picked != null && mine(picked) ? picked : null
  const moves = sel == null ? [] : movesFrom(state, sel)
  const targets = [...new Set(moves.map((m) => m.to))]
  const asking = promo && promo.ply === state.ply && canMove ? promo : null
  const last = state.last
  const over = overOf({ state, result, mySeat, names, reasons: 'games.covua.reason.' })
  const art = sk.art

  const tap = (i) => {
    if (!canMove) return
    if (sel != null && targets.includes(i)) {
      setPicked(null)
      if (moves.some((m) => m.to === i && m.promo)) setPromo({ ply: state.ply, from: sel, to: i })
      else onMove({ from: sel, to: i })
      return
    }
    setPromo(null)
    setPicked(mine(i) && picked !== i ? i : null)
  }
  const choose = (p) => { setPromo(null); onMove({ from: asking.from, to: asking.to, promo: p }) }

  // Quân còn trên bàn → quân đã mất của từng bên + cán cân (điểm hơn của người ngồi dưới).
  const count = [{}, {}]
  let mat = 0
  for (const p of state.board) {
    if (p == null) continue
    const side = colorOf(p)
    count[side][typeOf(p)] = (count[side][typeOf(p)] || 0) + 1
    mat += (side === me ? 1 : -1) * VAL[typeOf(p)]
  }
  /** Một quân cỡ `size` (bề ngang): ảnh nhân vật (skin có art) hoặc ký hiệu tô chuyển màu. */
  const piece = (side, type, size, extra) => (art
    ? <img src={art[side][type]} alt="" style={{ display: 'block', width: size, height: size * 1.2, pointerEvents: 'none', ...extra }} />
    : <span style={{ font: `400 ${size}px/1 ${FONT}`, backgroundImage: side === 0 ? sk.wG : sk.bG, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', filter: side === 0 ? sk.wF : sk.bF, ...extra }}>{GLYPH[type] + '︎'}</span>)
  /** Quân của `side` đã bị ăn — hiện ở thanh của người ăn. */
  const lost = (side) => Object.entries(FULL).flatMap(([type, n]) => Array.from({ length: Math.max(0, n - (count[side][type] || 0)) }, (_, k) => (art
    ? <img key={type + k} src={art[side][type]} alt="" style={{ width: 16, height: 19 }} />
    : <span key={type + k} style={{ font: `400 17px/1 ${FONT}`, color: side === 0 ? sk.wS : sk.bS, textShadow: '0 0 1px rgba(0,0,0,.9), 0 1px 1px rgba(0,0,0,.5)' }}>{GLYPH[type] + '︎'}</span>
  )))
  const icon = (side) => (
    <span style={{ width: 44, height: 44, borderRadius: 12, background: art ? sk.av[side] : sk.frame, display: 'grid', placeItems: art ? 'end center' : 'center', overflow: 'hidden', flexShrink: 0, boxShadow: art ? '0 0 0 2px ' + COL[side] : undefined }}>
      {piece(side, 'K', art ? 36 : 30)}
    </span>
  )
  const live = !over
  const bar = (seat) => ({
    mark: icon(seat), name: names?.[seat] || t('games.covua.mark' + seat), me: seat === mySeat, tag: tags?.[seat] ?? (seat === mySeat ? t('games.wait.youTag') : ''),
    caps: lost(1 - seat), adv: seat === me ? mat : -mat, clock: clocks ? clocks[seat] : null, bubble: bubbles?.[seat], glow: art ? COL[seat] : undefined,
    alert: live && state.check != null && state.turn === seat,
    status: note?.[seat] ?? (!live ? (seat === me ? over.title : '')
      : state.turn !== seat ? ''
        : seat === mySeat ? t(state.check != null ? 'games.covua.inCheck' : 'games.yourTurn')
          : t(state.check != null ? 'games.covua.check' : 'games.chess.thinking')),
  })
  const offer = live && state.offer != null ? {
    text: state.offer === mySeat ? t('games.chess.offerSent') : t('games.chess.offerGot', { name: names?.[state.offer] || t('games.covua.mark' + state.offer) }),
    answer: mySeat != null && state.offer !== mySeat ? (yes) => onMove({ draw: yes ? 'accept' : 'decline' }) : null,
  } : null
  const hinted = hint && canMove ? hint : null

  // Hiệu ứng của nước vừa đi (suy từ state.last, gắn key theo ply).
  const pills = []
  let duel = null
  let rise = null
  let cage = null
  if (last && state.board[last.to] != null) {
    const seat = last.seat
    const P = last.promo?.toUpperCase()
    const moved = P ? 'P' : typeOf(state.board[last.to])
    const name = (ty) => L('name.' + ty)
    const side = seat === me ? 0 : 1 // phe dưới đánh thì dải phim đi trái → phải
    if (last.captured && closeUp) {
      const ct = typeOf(last.captured)
      duel = (
        <CutScene key={'duel' + state.ply} kind="duel" blow={BLOW[moved]} att={CHESS_ART[seat][moved]} vic={CHESS_ART[1 - seat][ct]} col={COL[seat]} bg={BAND[seat]} side={side}
          title={L('duel', { a: name(moved), verb: L('verb.' + moved), v: name(ct) })} sub={L('skill.' + (moved === 'Q' ? 'Q' + seat : moved))} />
      )
    }
    if (last.castle) pills.push({ i: last.to, text: L('castle'), bg: '#00B2A9', fg: '#04302C' })
    if (P) {
      const revived = (count[seat][P] || 0) <= FULL[P] // quân phong ra từng mất → "hồi sinh"
      pills.push({ i: last.to, text: L(revived ? 'pillRevive' : 'pillPromo'), bg: revived ? '#d0ebff' : '#ffd76a', fg: '#1a1040', delay: duel ? CUT : 0.4 })
      if (closeUp) {
        rise = (
          <CutScene key={'rise' + state.ply} kind="rise" att={CHESS_ART[seat].P} vic={CHESS_ART[seat][P]} wing={revived} col={revived ? '#d0ebff' : '#ffd76a'} bg={BAND[seat]} delay={duel ? CUT : 0}
            title={L(revived ? 'reviveT' : 'promoT', { p: name(P) })} sub={L(revived ? 'reviveSub' : 'promoSub', { p: name(P) })} />
        )
      }
    }
    if (state.over && state.reason === 'mate') {
      const k = at(state.board.indexOf(seat === 0 ? 'k' : 'K'))
      const by = moved === 'K' ? 'R' : moved
      cage = { x: k.x, y: k.y + 15, mat: MAT[by], title: L('mate.' + by), sub: L('mateSub', { side: L('side' + seat) }), delay: Math.max(0.2, (duel ? CUT : 0) + (rise ? 1.9 : 0) - 0.3) }
    }
  }

  return (
    <ChessStage sk={sk} box={BOX} top={bar(foe)} bottom={bar(me)} turnTop={live && state.turn === foe} turnBottom={live && state.turn === me}
      evalPct={Math.max(4, Math.min(96, 50 + mat * 4))} over={over} overActions={overActions} actions={actions} offer={offer} overDelay={cage ? cage.delay + 2.7 : undefined}>
      <div role="group" aria-label={t('games.covua.boardAria')} style={{ display: 'grid', gridTemplateColumns: `repeat(8, ${S}px)`, gridTemplateRows: `repeat(8, ${S}px)`, borderRadius: BOX.radius, boxShadow: '0 0 0 1px ' + sk.border }}>
        {Array.from({ length: 64 }, (_, v) => {
          const i = disp(v)
          const p = state.board[i]
          const light = ((i >> 3) + (i & 7)) % 2 === 0
          const hot = last && (i === last.from || i === last.to)
          const target = targets.includes(i)
          const own = mine(i)
          const side = colorOf(p)
          const sq = FILES[i & 7] + (8 - (i >> 3))
          const tone = light ? sk.L : sk.D
          const r = BOX.radius
          let fx
          if (p != null && last && i === last.to) {
            const a = at(last.from)
            const b = at(i)
            fx = { '--dx': a.x - b.x + 'px', '--dy': a.y - b.y + 'px', animation: 'chSlide .36s cubic-bezier(.3,.7,.2,1)' }
          }
          return (
            <div key={v} onClick={() => tap(i)}
              role={target || own ? 'button' : undefined}
              aria-label={target ? t('games.covua.toAria', { sq }) : own ? t('games.covua.pieceAria', { sq }) : undefined}
              style={{
                position: 'relative', display: 'grid', placeItems: 'center', cursor: target || own ? 'pointer' : 'default', zIndex: fx ? 3 : undefined,
                // Góc bàn bo tròn ở bốn ô góc (không cắt cả lưới — đầu quân nhân vật được nhô lên khỏi ô).
                borderRadius: v === 0 ? `${r}px 0 0 0` : v === 7 ? `0 ${r}px 0 0` : v === 56 ? `0 0 0 ${r}px` : v === 63 ? `0 0 ${r}px 0` : undefined,
                background: (hot ? `linear-gradient(rgba(${sk.rgb},.38), rgba(${sk.rgb},.38)), ` : '') + (typeof tone === 'function' ? tone(v >> 3) : tone),
              }}>
              {target && p == null && <span style={{ position: 'absolute', width: 20, height: 20, borderRadius: '50%', background: `rgba(${sk.rgb},.9)`, boxShadow: `0 0 12px rgba(${sk.rgb},.8)` }} />}
              {target && p != null && <span style={{ position: 'absolute', inset: 5, borderRadius: '50%', border: `3px solid rgba(${sk.rgb},.9)`, boxShadow: `0 0 12px rgba(${sk.rgb},.8)` }} />}
              {p != null && (
                <span key={p + (fx ? state.ply : '')} style={{ position: 'relative', ...fx }}>
                  {piece(side, typeOf(p), art ? 62 : 56, art ? { position: 'relative', top: -21, transform: sel === i ? 'translateY(-5px) scale(1.06)' : 'none', transition: 'transform .18s' } : { transform: 'translateY(-3px)' })}
                </span>
              )}
              {(v & 7) === 0 && <span style={{ position: 'absolute', left: 4, top: 2, font: '700 10px/1 var(--font-mono)', color: light ? sk.cL : sk.cD }}>{8 - (i >> 3)}</span>}
              {v >> 3 === 7 && <span style={{ position: 'absolute', right: 4, bottom: 2, font: '700 10px/1 var(--font-mono)', color: light ? sk.cL : sk.cD }}>{FILES[i & 7]}</span>}
            </div>
          )
        })}
      </div>

      <ChessFx sk={sk} w={BOX.w} h={BOX.h} at={at} cell={S} ply={state.ply} last={last} pills={pills}
        cap={last?.captured ? { colors: colorOf(last.captured) === 0 ? sk.wC : sk.bC, node: piece(colorOf(last.captured), typeOf(last.captured), art ? 62 : 56) } : null}
        promo={!!last?.promo} check={live ? state.check : null} sel={sel} hint={hinted}
        banner={last && state.check != null && !cage ? { text: t('games.covua.bannerCheck') } : null} />
      {duel}
      {rise}
      {cage && <MateCage key={'cage' + state.ply} {...cage} />}

      {asking && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 15, display: 'grid', placeItems: 'center', background: 'rgba(5,6,16,.55)', borderRadius: BOX.radius }}>
          <div style={{ display: 'grid', gap: 12, justifyItems: 'center', padding: '18px 22px', borderRadius: 16, background: sk.frame, border: '2px solid ' + sk.border }}>
            <span style={{ font: '700 16px/1 var(--font-sans)', color: sk.acc }}>{t('games.covua.promoTitle')}</span>
            <div style={{ display: 'flex', gap: 10 }}>
              {PROMOS.map((p) => (
                <button key={p} type="button" onClick={() => choose(p)} title={t('games.covua.promo.' + p)} aria-label={t('games.covua.promo.' + p)}
                  style={{ width: 76, height: art ? 90 : 76, borderRadius: 12, cursor: 'pointer', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.08)', border: `1px solid rgba(${sk.rgb},.5)` }}>
                  {piece(mySeat, p.toUpperCase(), art ? 58 : 52, art ? null : { filter: 'none' })}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </ChessStage>
  )
}
