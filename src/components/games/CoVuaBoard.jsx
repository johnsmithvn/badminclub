import { useState } from 'react'
import { t } from '#i18n'
import { colorOf, movesFrom, PROMOS, typeOf } from '#lib/games/covua.js'
import { useSkin } from '#components/games/chessSkins.js'
import { overOf, useChessClock } from '#components/games/chessUi.js'
import ChessStage, { ChessFx } from '#components/games/ChessStage.jsx'

// Bàn Cờ vua (bản thiết kế "Co Vua"): 3 skin chọn được (chessSkins.js — Huyền bí / Băng giá / Rừng cổ), khung và hiệu
// ứng ở ChessStage. Ô là lưới 8 × 8 cỡ thiết kế 74px (ChessStage co cho vừa màn hình); quân là ký hiệu cờ chuẩn
// (Unicode) tô chuyển màu theo skin. Ghế 1 (quân đen) thấy bàn xoay 180° để quân mình luôn ở dưới.
// Chạm quân → chấm ô đi được → chạm ô. Tốt lên hàng cuối thì hiện bảng chọn quân phong ngay trên bàn.
// Thanh người chơi: quân đã ăn (suy từ số quân còn trên bàn) + điểm hơn; cột cán cân theo tổng giá trị quân.
// Đồng hồ tổng + xin hoà: lib/games/chessClock.js. `hint` { from, to } (phòng máy) vẽ mũi tên gợi ý.
// Luật: lib/games/covua.js.
// ponytail: quân vẽ bằng ký hiệu Unicode (font hệ thống) — đổi sang SVG path riêng nếu máy nào hiện xấu.

const S = 74 // cạnh một ô (px thiết kế)
const BOX = { w: S * 8, h: S * 8, pad: 20, radius: 6 }
// ︎ (U+FE0E): ép hiện dạng chữ (không phải emoji) trên iOS / Android.
const GLYPH = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' }
const glyph = (p) => GLYPH[typeOf(p)] + '︎'
const FONT = "'Segoe UI Symbol', 'DejaVu Sans', 'Noto Sans Symbols 2', 'Apple Symbols', sans-serif"
const VAL = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 }
const FULL = { Q: 1, R: 2, B: 2, N: 2, P: 8 } // số quân lúc đầu ván (thứ tự hiện: quân to trước)
const FILES = 'abcdefgh'

export default function CoVuaBoard({ state, mySeat, canMove, onMove, result, names, tags, note, actions, overActions, hint }) {
  const [, sk] = useSkin('covua')
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
  const pieceStyle = (side, size) => ({
    font: `400 ${size}px/1 ${FONT}`, backgroundImage: side === 0 ? sk.wG : sk.bG, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
  })
  /** Quân của `side` đã bị ăn — hiện ở thanh của người ăn. */
  const lost = (side) => Object.entries(FULL).flatMap(([type, n]) => Array.from({ length: Math.max(0, n - (count[side][type] || 0)) }, (_, k) => (
    <span key={type + k} style={{ font: `400 17px/1 ${FONT}`, color: side === 0 ? sk.wS : sk.bS, textShadow: '0 0 1px rgba(0,0,0,.9), 0 1px 1px rgba(0,0,0,.5)' }}>{GLYPH[type] + '︎'}</span>
  )))
  const icon = (side) => (
    <span style={{ width: 44, height: 44, borderRadius: 12, background: sk.frame, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      <span style={{ ...pieceStyle(side, 30), filter: side === 0 ? sk.wF : sk.bF }}>{GLYPH.K + '︎'}</span>
    </span>
  )
  const live = !over
  const bar = (seat) => ({
    mark: icon(seat), name: names?.[seat] || t('games.covua.mark' + seat), me: seat === mySeat, tag: tags?.[seat] ?? (seat === mySeat ? t('games.wait.youTag') : ''),
    caps: lost(1 - seat), adv: seat === me ? mat : -mat, clock: clocks ? clocks[seat] : null,
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

  return (
    <ChessStage sk={sk} box={BOX} top={bar(foe)} bottom={bar(me)} turnTop={live && state.turn === foe} turnBottom={live && state.turn === me}
      evalPct={Math.max(4, Math.min(96, 50 + mat * 4))} over={over} overActions={overActions} actions={actions} offer={offer}>
      <div role="group" aria-label={t('games.covua.boardAria')} style={{ display: 'grid', gridTemplateColumns: `repeat(8, ${S}px)`, gridTemplateRows: `repeat(8, ${S}px)`, borderRadius: BOX.radius, overflow: 'hidden', boxShadow: '0 0 0 1px ' + sk.border }}>
        {Array.from({ length: 64 }, (_, v) => {
          const i = disp(v)
          const p = state.board[i]
          const light = ((i >> 3) + (i & 7)) % 2 === 0
          const hot = last && (i === last.from || i === last.to)
          const target = targets.includes(i)
          const own = mine(i)
          const side = colorOf(p)
          const sq = FILES[i & 7] + (8 - (i >> 3))
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
                background: (hot ? `linear-gradient(rgba(${sk.rgb},.38), rgba(${sk.rgb},.38)), ` : '') + (light ? sk.L : sk.D),
              }}>
              {target && p == null && <span style={{ position: 'absolute', width: 20, height: 20, borderRadius: '50%', background: `rgba(${sk.rgb},.9)`, boxShadow: `0 0 12px rgba(${sk.rgb},.8)` }} />}
              {target && p != null && <span style={{ position: 'absolute', inset: 5, borderRadius: '50%', border: `3px solid rgba(${sk.rgb},.9)`, boxShadow: `0 0 12px rgba(${sk.rgb},.8)` }} />}
              {p != null && (
                <span key={p + (fx ? state.ply : '')} style={{ position: 'relative', ...pieceStyle(side, 56), filter: side === 0 ? sk.wF : sk.bF, transform: 'translateY(-3px)', ...fx }}>{glyph(p)}</span>
              )}
              {(v & 7) === 0 && <span style={{ position: 'absolute', left: 4, top: 2, font: '700 10px/1 var(--font-mono)', color: light ? sk.cL : sk.cD }}>{8 - (i >> 3)}</span>}
              {v >> 3 === 7 && <span style={{ position: 'absolute', right: 4, bottom: 2, font: '700 10px/1 var(--font-mono)', color: light ? sk.cL : sk.cD }}>{FILES[i & 7]}</span>}
            </div>
          )
        })}
      </div>

      <ChessFx sk={sk} w={BOX.w} h={BOX.h} at={at} cell={S} ply={state.ply} last={last}
        cap={last?.captured ? { colors: colorOf(last.captured) === 0 ? sk.wC : sk.bC, node: <span style={{ font: `400 56px/1 ${FONT}`, color: (colorOf(last.captured) === 0 ? sk.wC : sk.bC)[1] }}>{glyph(last.captured)}</span> } : null}
        promo={!!last?.promo} check={live ? state.check : null} sel={sel} hint={hinted}
        banner={last && state.check != null ? { text: t(state.reason === 'mate' ? 'games.covua.bannerMate' : 'games.covua.bannerCheck'), mate: state.reason === 'mate' } : null} />

      {asking && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 15, display: 'grid', placeItems: 'center', background: 'rgba(5,6,16,.55)', borderRadius: BOX.radius }}>
          <div style={{ display: 'grid', gap: 12, justifyItems: 'center', padding: '18px 22px', borderRadius: 16, background: sk.frame, border: '2px solid ' + sk.border }}>
            <span style={{ font: '700 16px/1 var(--font-sans)', color: sk.acc }}>{t('games.covua.promoTitle')}</span>
            <div style={{ display: 'flex', gap: 10 }}>
              {PROMOS.map((p) => (
                <button key={p} type="button" onClick={() => choose(p)} title={t('games.covua.promo.' + p)} aria-label={t('games.covua.promo.' + p)}
                  style={{ width: 76, height: 76, borderRadius: 12, cursor: 'pointer', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.08)', border: `1px solid rgba(${sk.rgb},.5)` }}>
                  <span style={pieceStyle(mySeat, 52)}>{GLYPH[p.toUpperCase()] + '︎'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </ChessStage>
  )
}
