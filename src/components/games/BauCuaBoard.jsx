import { useEffect, useState } from 'react'
import { Avatar, Icon } from '#ds'
import { useApp } from '#contexts/AppContext.jsx'
import { G, btn, card } from '#components/games/stage.js'
import { useFit } from '#components/games/chessUi.js'
import { BauCuaIcon } from '#components/games/BauCuaIcons.jsx'
import bc, { budgetOf, CAP, CHIPS, deadlineOf, SYMS, waitingOf } from '#lib/games/baucua.js'
import { chipsOf } from '#lib/games/registry.js'
import { t } from '#i18n'

/**
 * Bàn Bầu cua (bản thiết kế "Bầu Cua Tôm Cá", 2026-11-11): ghế người khác ở trên, chiếu trúc viền đỏ ở giữa (giấy sáu
 * con bên trái, đĩa + bát sứ và bảng trạng thái bên phải), thanh của mình ở đáy (xu mệnh giá · Hoàn tác · Đặt lại · nút
 * lớn). Màn hẹp: đĩa + trạng thái lên trên, giấy sáu con xuống dưới.
 *
 * Luật giữ nguyên (lib/games/baucua.js): người đặt chọn mệnh giá, chạm con muốn đặt, Chốt (chốt rồi không sửa). Cái
 * bấm Mở bát khi cả bàn đã chốt; hết giờ thì máy bất kỳ tự gửi { roll } — server lắc và chỉ nhận khi đúng là đã đủ / đã
 * hết giờ (0096). Mở bát xong ván mới bắt đầu ngay; bát nhấc lên REVEAL ms để xem hột (tính theo `since` của ván mới).
 * Phòng có cược (0101): mỗi điểm = `stake` xu; tổng đặt mỗi ván không quá số điểm còn trên bàn (budgetOf).
 * Props sân khấu (GameRoom `stageProps`): `actions` nút dưới bàn, `overActions` nút ở bảng tổng kết, `note` mất kết nối.
 */

// Chiếu, giấy, đĩa, bát, xúc xắc, đồng xu: "vật" có màu riêng, giữ nguyên ở cả sáng / tối (DESIGN.md §2.4).
const BC = {
  ink: '#2a1810', paper: '#f6e7c3', paperLine: '#c9ad74', red: '#b8322a', redInk: '#a3271f', rim: '#8f2219',
  hit: '#ffe9a3', gold: '#ffe08a', goldHi: '#ffe9b8', tan: '#e3cfae', lose: '#ffc2b8', panel: 'linear-gradient(180deg,#4a2218,#32140d)',
  mat: 'linear-gradient(180deg,transparent 0 14px,rgba(168,40,32,.85) 14px 18px,transparent 18px 23px,rgba(40,105,60,.8) 23px 26px,transparent 26px),'
    + 'linear-gradient(0deg,transparent 0 14px,rgba(168,40,32,.85) 14px 18px,transparent 18px 23px,rgba(40,105,60,.8) 23px 26px,transparent 26px),'
    + 'repeating-linear-gradient(90deg,rgba(110,70,15,.16) 0 1px,transparent 1px 5px),'
    + 'repeating-linear-gradient(0deg,rgba(255,255,255,.1) 0 3px,transparent 3px 26px,rgba(100,65,10,.12) 26px 29px,transparent 29px 52px),'
    + 'linear-gradient(135deg,#e6c780,#cfa857 55%,#d9b76a)',
  matShadow: '0 0 0 2px #5c120c, inset 0 0 0 2px rgba(255,220,160,.35), inset 0 0 70px rgba(90,50,10,.35), 0 30px 60px -24px rgba(0,0,0,.6)',
  plate: 'radial-gradient(circle closest-side,transparent 0 86%,rgba(42,79,158,.9) 86% 88%,transparent 88% 93%,rgba(42,79,158,.9) 93% 94.5%,transparent 94.5%),'
    + 'radial-gradient(circle at 44% 40%,#ffffff 0,#f1f4f7 52%,#cbd5df 100%)',
  bowl: 'radial-gradient(circle closest-side,#f3f6f9 0 26%,#b9c6d4 26% 27.5%,#ffffff 27.5% 34%,#aebccb 34% 35.5%,transparent 35.5%),'
    + 'radial-gradient(circle closest-side,transparent 0 44%,#2a4f9e 44% 45.5%,transparent 45.5% 80%,#2a4f9e 80% 81.5%,transparent 81.5% 87%,#2a4f9e 87% 91%,transparent 91%),'
    + 'radial-gradient(circle at 42% 36%,#ffffff 0,#f3f6f9 40%,#d3dce6 75%,#a9b6c5 100%)',
  bowlRing: 'repeating-conic-gradient(from 0deg,transparent 0 7deg,rgba(42,79,158,.85) 10deg 17deg,transparent 20deg 30deg)',
  bowlMask: 'radial-gradient(circle closest-side,transparent 0 50%,#000 50% 76%,transparent 76%)',
  die: 'linear-gradient(145deg,#fffdf6,#eadfc4)',
}
// Đồng xu theo CHIPS (1 · 2 · 5 điểm): đồng · bạc · vàng.
const COIN = [['linear-gradient(145deg,#f0b27c,#a85a24)', '#6b3410'], ['linear-gradient(145deg,#f6f8fb,#98a2b0)', '#4a5260'], ['linear-gradient(145deg,#ffe596,#c98f1e)', '#7a5206']]
// Thứ tự ô trên giấy như tranh dân gian: Nai · Bầu · Gà / Cá · Cua · Tôm (chỉ số trong SYMS).
const GRID = [5, 0, 4, 3, 1, 2]
// Chỗ ba hột trên đĩa (tỉ lệ theo cỡ đĩa) và góc nghiêng.
const DPOS = [[0.18, 0.15, -12], [0.52, 0.24, 10], [0.28, 0.54, -5]]
const REVEAL = 5000
const DW = 840 // rộng đủ cho bố cục hai cột

const sym = (k) => t('games.baucua.sym.' + SYMS[k])
const side = (seat) => t('games.baucua.mark' + seat)
const signed = (n) => (n > 0 ? '+' + n : String(n))
const zero = () => SYMS.map(() => 0)
const sum = (a) => a.reduce((x, y) => x + y, 0)
/** Đồng xu xếp chồng cho một mức đặt: tách tham lam theo CHIPS, tối đa 5 đồng. */
const coinsOf = (n) => {
  const out = []
  for (let i = CHIPS.length - 1; i >= 0 && out.length < 5; i--) {
    while (n >= CHIPS[i] && out.length < 5) { out.push(i); n -= CHIPS[i] }
  }
  return out
}

/** Đồng hồ máy, nhích mỗi giây khi có hạn đặt. */
function useNow(on) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!on) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [on])
  return now
}

function Coin({ i, size }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', background: COIN[i][0], border: '1.5px solid ' + COIN[i][1], boxShadow: `0 2px 0 ${COIN[i][1]}, 0 3px 5px rgba(0,0,0,.35)`, display: 'grid', placeItems: 'center' }}>
      <span style={{ width: size / 4, height: size / 4, background: BC.paper, boxShadow: 'inset 0 1px 2px rgba(0,0,0,.45)' }} />
    </span>
  )
}

export default function BauCuaBoard({ state, mySeat, onMove, result, players = [], names, stake = 0, actions, overActions, note }) {
  const { db } = useApp()
  const [ref, k] = useFit(DW)
  const wide = k > 0.8
  const [chip, setChip] = useState(0) // chỉ số trong CHIPS
  // Nháp theo ván (danh sách lần đặt, để Hoàn tác): sang ván mới là tự bỏ nháp cũ.
  const [draft, setDraft] = useState({ round: -1, puts: [] })
  const puts = draft.round === state.round ? draft.puts : []
  const bet = puts.reduce((b, [s, v]) => b.map((x, i) => (i === s ? x + v : x)), zero())
  const total = sum(bet)

  const { started, over, banker, last } = state
  const seated = mySeat != null && started && !state.out[mySeat]
  const live = started && !over && !result
  const canBet = live && seated && mySeat !== banker && !state.ready[mySeat]
  const buyinOf = (seat) => players.find((p) => p.seat === seat)?.buyin ?? null
  const myBuyin = stake > 0 && mySeat != null ? buyinOf(mySeat) : null
  const limit = myBuyin != null ? Math.max(0, Math.min(CAP, budgetOf(myBuyin, stake, state.scores[mySeat] || 0))) : CAP
  const add = (s) => { if (canBet && total + CHIPS[chip] <= limit) setDraft({ round: state.round, puts: [...puts, [s, CHIPS[chip]]] }) }

  // Mở bát: cả bàn chốt thì gửi ngay, không thì chờ hết giờ. Cái gửi trước, người khác chờ thêm (phòng máy cái đã tắt).
  // Server đo bằng giờ của nó; sớm thì im lặng, mỗi 4 giây thử lại.
  const due = deadlineOf(state)
  const now = useNow(started && !over)
  const [again, setAgain] = useState(0)
  const all = live && !waitingOf(state).length
  useEffect(() => {
    if (!live || !seated || due == null) return undefined
    const n = state.n0
    const rank = (mySeat - banker + n) % n
    const wait = (all ? 0 : Math.max(0, due - Date.now())) + (rank === 0 ? 300 : 1500 + rank * 700)
    const fire = setTimeout(() => onMove({ roll: true }), wait)
    const retry = setTimeout(() => setAgain((x) => x + 1), wait + 4000)
    return () => { clearTimeout(fire); clearTimeout(retry) }
  }, [live, seated, due, all, mySeat, banker, state.n0, state.ply, again, onMove])
  const secs = live && due != null ? Math.max(0, Math.ceil((due - now) / 1000)) : null
  const rolling = live && (all || secs === 0)

  // Ván trước: giữ tối đa 4 bát gần nhất trên máy này (state chỉ có bát cuối).
  const [hist, setHist] = useState({ round: -1, list: [] })
  if (last?.dice && hist.round !== state.round) setHist({ round: state.round, list: [last.dice, ...hist.list].slice(0, 4) })

  const memberOf = (seat) => db.members.find((m) => m.id === players.find((p) => p.seat === seat)?.memberId)
  const nameOf = (seat) => names?.[seat] || side(seat)

  if (!started) return <div style={{ ...card, padding: 24, textAlign: 'center', font: 'var(--type-caption)', color: G.muted }}>{t('games.baucua.waiting')}</div>

  const open = !!last?.dice && (over || (state.since != null && now - state.since < REVEAL))
  const cnt = (s) => (open ? last.dice.filter((d) => d === s).length : 0)
  const scores = result?.scores || bc.result(state)?.scores || Object.fromEntries(state.scores.map((v, i) => [i, v]))
  const amt = (p) => (stake > 0 ? t('games.coins.stakeOpt', { n: (p * stake).toLocaleString('vi-VN') }) : t('games.baucua.points', { n: p }))
  const mineOf = (s) => (state.ready[mySeat] ? state.bets[mySeat]?.[s] || 0 : bet[s])
  const othersOn = (s) => state.bets.map((b, i) => (i !== mySeat && b[s] ? i : null)).filter((i) => i != null)
  const myNet = last?.won && mySeat != null ? (mySeat === last.banker ? -sum(last.won) : last.won[mySeat] || 0) : null

  // ── Bảng trạng thái ──
  let head
  let sub = ''
  let subC = BC.tan
  if (over && !open) head = t('games.baucua.final')
  else if (open) {
    head = last.dice.map(sym).join(' · ')
    if (myNet != null) {
      sub = mySeat === last.banker ? t('games.baucua.bankerWon', { n: signed(myNet) }) : t('games.baucua.youWon', { n: signed(myNet) })
      subC = myNet > 0 ? BC.gold : myNet < 0 ? BC.lose : BC.tan
    }
  } else if (rolling) head = t('games.baucua.rolling')
  else {
    head = t('games.baucua.betNow')
    sub = t('games.baucua.betSub')
  }
  const roundTxt = over ? '' : t('games.baucua.round', { r: state.round + 1, n: state.rounds })

  // ── Ghế người khác ──
  const pillOf = (seat) => {
    if (state.out[seat]) return [t('games.baucua.stOut'), BC.tan]
    if (over) return null
    if (seat === banker) return [t('games.baucua.dealer'), BC.gold]
    return state.ready[seat] ? [t('games.baucua.stLocked') + ' · ' + amt(sum(state.bets[seat])), BC.gold] : [t('games.baucua.stBetting') + '…', BC.tan]
  }
  const scoreTxt = (seat) => {
    const sc = scores?.[seat] ?? 0
    return stake > 0 && buyinOf(seat) != null
      ? t('games.coins.onTable', { n: chipsOf(buyinOf(seat), sc, stake).toLocaleString('vi-VN') })
      : t('games.baucua.points', { n: signed(sc) })
  }
  const others = state.scores.map((_, s) => s).filter((s) => s !== mySeat)

  // ── Đĩa + bát ──
  const P = wide ? 250 : 150
  const B = P * 0.76
  const plate = (
    <div data-game-fx style={{ flex: 'none' }}>
    <div style={{ position: 'relative', width: P, height: P, animation: rolling ? 'bcShake 1.4s ease-in-out infinite' : 'none' }}>
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: BC.plate, boxShadow: '0 16px 24px -6px rgba(60,30,5,.6), inset 0 -8px 18px rgba(70,90,120,.28), inset 0 0 0 1px rgba(120,140,165,.5)' }} />
      {open && last.dice.map((d, i) => (
        <span key={state.round + '-' + i} style={{
          position: 'absolute', left: DPOS[i][0] * P, top: DPOS[i][1] * P, width: P * 0.29, height: P * 0.29, borderRadius: P * 0.055, rotate: DPOS[i][2] + 'deg',
          background: BC.die, border: '1px solid #b9a67c', boxShadow: 'inset 0 -5px 0 rgba(150,120,70,.35), inset 0 2px 0 #fff, 0 8px 12px rgba(0,0,0,.35)',
          display: 'grid', placeItems: 'center', animation: `gamePop .5s ease-out ${i * 0.09}s both`,
        }}><BauCuaIcon sym={d} size={P * 0.21} /></span>
      ))}
      <button type="button" aria-label={t('games.baucua.open')} disabled={!(seated && mySeat === banker && all)} onClick={() => onMove({ roll: true })} style={{
        position: 'absolute', left: (P - B) / 2, top: (P - B) / 2, width: B, height: B, borderRadius: '50%', border: 0, padding: 0, background: BC.bowl,
        boxShadow: '0 16px 22px -4px rgba(50,25,5,.6), inset 0 -10px 20px rgba(60,80,110,.3), inset 0 0 0 1px rgba(120,140,165,.6)',
        transition: 'transform .6s cubic-bezier(.3,.8,.3,1), opacity .6s', pointerEvents: open ? 'none' : undefined,
        transform: open ? (wide ? `translate(${P * 0.74}px, ${-P * 0.2}px) rotate(22deg)` : `translateY(${-P * 0.5}px) scale(.85)`) : 'none',
        opacity: open && !wide ? 0 : 1, cursor: seated && mySeat === banker && all ? 'pointer' : 'default',
      }}>
        <span aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: BC.bowlRing, WebkitMask: BC.bowlMask, mask: BC.bowlMask }} />
      </button>
    </div>
    </div>
  )

  const panel = (
    <div aria-live="polite" style={{ flex: 1, minWidth: 0, alignSelf: 'stretch', padding: wide ? '14px 16px' : '10px 12px', borderRadius: 12, background: BC.panel, border: '1px solid rgba(255,220,160,.3)', boxShadow: '0 10px 18px -8px rgba(40,15,0,.7)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'grid', gap: 3, minWidth: 0 }}>
          {roundTxt && <span style={{ font: '600 11px/1 var(--font-mono)', letterSpacing: '.1em', color: BC.tan }}>{roundTxt.toUpperCase()}</span>}
          <span style={{ font: `800 ${wide ? 20 : 16}px/1.2 var(--font-display)`, color: BC.goldHi }}>{head}</span>
          {sub && <span style={{ font: '600 12.5px/1.35 var(--font-sans)', color: subC }}>{sub}</span>}
        </div>
        {secs != null && !open && !rolling && (
          <span role="timer" style={{ flex: 'none', padding: '6px 10px', borderRadius: 10, background: 'rgba(20,8,4,.6)', border: '1px solid rgba(255,224,138,.4)', font: `700 ${wide ? 24 : 18}px/1 var(--font-mono)`, color: secs <= 5 ? BC.lose : BC.gold }}>
            0:{String(secs).padStart(2, '0')}
          </span>
        )}
      </div>
      {hist.list.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ font: '600 10.5px/1 var(--font-mono)', letterSpacing: '.12em', color: BC.tan }}>{t('games.baucua.prev').toUpperCase()}</span>
          {hist.list.map((h, i) => (
            <span key={i} title={h.map(sym).join(' · ')} style={{ display: 'flex', gap: 1, padding: '3px 5px', borderRadius: 7, background: BC.paper }}>
              {h.map((d, j) => <BauCuaIcon key={j} sym={d} size={wide ? 20 : 16} />)}
            </span>
          ))}
        </div>
      )}
    </div>
  )

  const bankerRow = banker != null && !over && (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, alignSelf: 'flex-start' }}>
      <Avatar name={memberOf(banker)?.name || nameOf(banker)} src={memberOf(banker)?.avatarUrl} size={38} />
      <div style={{ display: 'grid', lineHeight: 1.3 }}>
        <span style={{ font: '800 14px/1.3 var(--font-sans)', color: BC.ink }}>{nameOf(banker)}{banker === mySeat ? ' ' + t('games.wait.youTag') : ''}</span>
        <span style={{ font: '600 12px/1.3 var(--font-sans)', color: '#5a2f12' }}>{t('games.baucua.dealerSub')}</span>
      </div>
    </div>
  )

  // ── Thanh của mình ──
  const isBanker = seated && mySeat === banker
  const locked = seated && state.ready[mySeat]
  let actLabel
  let act = null
  if (isBanker) {
    const w = waitingOf(state).length
    actLabel = all ? t('games.baucua.open') : t('games.baucua.waitLock', { n: w })
    if (all) act = () => onMove({ roll: true })
  } else if (locked) actLabel = t('games.baucua.btnLocked')
  else {
    actLabel = total ? t('games.baucua.lock', { n: amt(total) }) : t('games.baucua.lockZero')
    act = () => onMove({ bet })
  }
  const myTotal = locked ? sum(state.bets[mySeat]) : total
  const meLine = isBanker ? t('games.baucua.youBanker')
    : myTotal ? t('games.baucua.myBet', { v: amt(myTotal) })
      : limit === 0 && stake > 0 ? t('games.baucua.broke') : t('games.baucua.noBet')

  return (
    <div ref={ref} style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(0, 1fr)', userSelect: 'none' }}>
      {/* Ghế người khác */}
      {others.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: wide ? '10px 28px' : '8px 6px' }}>
          {others.map((s) => {
            const pill = pillOf(s)
            const m = memberOf(s)
            const on = !over && s === banker
            return (
              <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: wide ? 130 : 72, opacity: state.out[s] ? 0.5 : 1 }}>
                <span style={{ borderRadius: '50%', lineHeight: 0, boxShadow: `0 0 0 3px ${on ? BC.gold : G.line}` }}><Avatar name={m?.name || nameOf(s)} src={m?.avatarUrl} size={wide ? 48 : 36} /></span>
                <span style={{ maxWidth: '100%', font: `700 ${wide ? 13 : 11.5}px/1.2 var(--font-sans)`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nameOf(s)}</span>
                {pill && (
                  <span style={{ maxWidth: '100%', padding: '3px 9px', borderRadius: 99, background: '#2a120c', color: pill[1], font: `600 ${wide ? 11.5 : 10}px/1.3 var(--font-mono)`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pill[0]}</span>
                )}
                <span style={{ font: '400 11px/1.2 var(--font-mono)', color: G.muted, whiteSpace: 'nowrap' }}>{scoreTxt(s)}</span>
                {note?.[s] && <span style={{ font: '400 11px/1.2 var(--font-mono)', color: G.goldHi, whiteSpace: 'nowrap' }}>{note[s]}</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* Chiếu */}
      <div style={{ borderRadius: 6, border: `${wide ? 9 : 6}px solid ${BC.rim}`, background: BC.mat, boxShadow: BC.matShadow, padding: wide ? 36 : 12, display: 'flex', flexDirection: wide ? 'row' : 'column', alignItems: 'center', gap: wide ? 24 : 12 }}>
        <div style={{ order: wide ? 0 : 1, flex: wide ? '1 1 0' : 'none', width: wide ? undefined : '100%', minWidth: 0, maxWidth: 560, padding: wide ? 12 : 8, background: BC.paper, border: '1px solid ' + BC.paperLine, boxShadow: '0 10px 18px -6px rgba(70,35,5,.55)', transform: wide ? 'rotate(-.6deg)' : 'none' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 4, padding: 4, background: BC.red }}>
            {GRID.map((s) => {
              const mine = mineOf(s)
              const c = cnt(s)
              const hit = c > 0
              const who = othersOn(s)
              const whole = sum(state.bets.map((b, i) => (i === mySeat ? 0 : b[s]))) + mine
              return (
                <button key={s} type="button" onClick={() => add(s)} disabled={!canBet}
                  aria-label={sym(s) + (mine ? ' · ' + t('games.baucua.mine', { n: amt(mine) }) : '')}
                  style={{
                    position: 'relative', height: wide ? 150 : 104, display: 'grid', placeItems: 'center', border: 0, padding: 0, color: 'inherit', touchAction: 'manipulation',
                    background: hit ? BC.hit : BC.paper, boxShadow: hit ? 'inset 0 0 0 4px #d99a1e, 0 0 24px rgba(255,205,90,.85)' : 'none',
                    opacity: open && !hit ? 0.45 : 1, cursor: canBet ? 'pointer' : 'default', transition: 'opacity .3s, background .3s',
                  }}>
                  <span style={{ marginTop: 10, lineHeight: 0 }}><BauCuaIcon sym={s} size={wide ? 92 : 60} /></span>
                  <span style={{ position: 'absolute', left: wide ? 10 : 6, top: wide ? 6 : 3, font: `800 ${wide ? 19 : 14}px/1.2 var(--font-display)`, color: BC.redInk }}>{sym(s)}</span>
                  {who.length > 0 && (
                    <span style={{ position: 'absolute', right: wide ? 8 : 4, top: wide ? 8 : 5, display: 'flex', gap: 2 }}>
                      {who.slice(-(wide ? 4 : 3)).map((i) => (
                        <span key={i} title={nameOf(i)} style={{ width: wide ? 22 : 16, height: wide ? 22 : 16, borderRadius: '50%', background: '#5b6fd6', color: '#fff', font: `800 ${wide ? 11 : 9}px/1 var(--font-sans)`, display: 'grid', placeItems: 'center', boxShadow: '0 0 0 2px ' + BC.paper }}>
                          {nameOf(i).slice(0, 1).toUpperCase()}
                        </span>
                      ))}
                    </span>
                  )}
                  {whole > 0 && wide && <span style={{ position: 'absolute', left: 10, bottom: 8, font: '700 11px/1 var(--font-mono)', color: '#6b3a16', whiteSpace: 'nowrap' }}>{t('games.baucua.table', { n: amt(whole) })}</span>}
                  {mine > 0 && (
                    <>
                      <span style={{ position: 'absolute', right: wide ? 10 : 5, bottom: wide ? 9 : 5, display: 'flex', flexDirection: 'column-reverse' }}>
                        {coinsOf(mine).map((i, j) => <span key={j} style={{ marginTop: j ? -(wide ? 25 : 16) : 0 }}><Coin i={i} size={wide ? 30 : 20} /></span>)}
                      </span>
                      <span style={{ position: 'absolute', right: wide ? 46 : undefined, left: wide ? undefined : 5, bottom: wide ? 9 : 5, padding: '2px 8px', borderRadius: 99, background: '#3d1a12', color: BC.gold, font: `700 ${wide ? 13 : 11}px/1.2 var(--font-mono)` }}>{stake > 0 ? (mine * stake).toLocaleString('vi-VN') : mine}</span>
                    </>
                  )}
                  {hit && (
                    <span style={{ position: 'absolute', right: wide ? 8 : 4, top: wide ? 38 : 24, width: wide ? 44 : 30, height: wide ? 44 : 30, borderRadius: '50%', background: BC.red, color: '#fff3d6', font: `800 ${wide ? 18 : 13}px/1 var(--font-display)`, display: 'grid', placeItems: 'center', boxShadow: '0 0 0 3px #fff3d6, 0 4px 10px rgba(0,0,0,.4)', animation: 'gamePop .45s ease-out both' }}>×{c}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ order: wide ? 1 : 0, flex: wide ? '0 0 300px' : 'none', width: wide ? undefined : '100%', display: 'flex', flexDirection: wide ? 'column' : 'row', alignItems: 'center', gap: wide ? 14 : 10 }}>
          {wide && bankerRow}
          {plate}
          {panel}
        </div>
      </div>

      {/* Thanh của mình / tổng kết */}
      {over ? (
        <div style={{ ...card, padding: 16, display: 'grid', gap: 10 }}>
          <span style={{ font: '800 18px/1.2 var(--font-display)', textAlign: 'center' }}>{t('games.baucua.final')}</span>
          {state.scores.map((_, s) => s).sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0)).map((s, pos) => {
            const sc = scores[s] ?? 0
            return (
              <div key={s} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) auto', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 10, background: pos ? G.inset : G.goldA(0.1), opacity: state.out[s] ? 0.6 : 1 }}>
                <Avatar name={memberOf(s)?.name || nameOf(s)} src={memberOf(s)?.avatarUrl} size={26} />
                <span style={{ font: '700 14px/1.2 var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {nameOf(s)}{s === mySeat ? ' ' + t('games.wait.youTag') : ''}{state.out[s] ? ' · ' + t('games.baucua.stOut') : ''}
                </span>
                <span style={{ font: '700 14px/1 var(--font-mono)', color: sc > 0 ? G.tealHi : sc < 0 ? G.red : G.muted }}>
                  {stake > 0 ? t('games.coins.stakeOpt', { n: signed(sc * stake) }) : t('games.baucua.points', { n: signed(sc) })}
                </span>
              </div>
            )
          })}
          {overActions?.length > 0 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {overActions.map((x) => <button key={x.key} type="button" onClick={x.on} style={{ ...btn('primary'), padding: '12px 22px', font: '800 14px/1 var(--font-sans)' }}>{x.label}</button>)}
            </div>
          )}
        </div>
      ) : seated && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: wide ? 20 : 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: wide ? '0 1 240px' : '1 1 100%' }}>
            <span style={{ borderRadius: '50%', lineHeight: 0, boxShadow: '0 0 0 3px ' + (isBanker ? BC.gold : G.tealA(0.6)) }}><Avatar name={memberOf(mySeat)?.name || nameOf(mySeat)} src={memberOf(mySeat)?.avatarUrl} size={44} /></span>
            <div style={{ display: 'grid', gap: 2, minWidth: 0 }}>
              <span style={{ font: '800 15px/1.2 var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {nameOf(mySeat)} <span style={{ fontWeight: 500, fontSize: 12, color: G.muted }}>{t('games.wait.youTag')}</span>
              </span>
              <span style={{ font: '600 12.5px/1.3 var(--font-sans)', color: limit === 0 && stake > 0 && !isBanker ? G.red : G.goldHi }}>{meLine}</span>
              <span style={{ font: '400 11.5px/1.2 var(--font-mono)', color: G.muted }}>{scoreTxt(mySeat)}</span>
            </div>
          </div>

          {canBet && (
            <div role="group" aria-label={t('games.baucua.chip')} style={{ display: 'flex', alignItems: 'flex-end', gap: wide ? 16 : 10 }}>
              {CHIPS.map((c, i) => {
                const on = chip === i
                const off = total + c > limit
                return (
                  <button key={c} type="button" onClick={() => setChip(i)} aria-pressed={on} aria-label={t('games.baucua.chip') + ' ' + amt(c)} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, border: 0, padding: 0, background: 'none', color: 'inherit', cursor: 'pointer',
                    transform: on ? 'translateY(-6px)' : 'none', transition: 'transform .15s', opacity: off ? 0.4 : 1,
                  }}>
                    <span style={{ borderRadius: '50%', lineHeight: 0, boxShadow: on ? '0 0 0 3px ' + BC.gold + ', 0 10px 16px rgba(0,0,0,.35)' : '0 4px 8px rgba(0,0,0,.3)' }}><Coin i={i} size={wide ? 54 : 46} /></span>
                    <span style={{ font: '700 12.5px/1 var(--font-mono)', color: on ? G.goldHi : G.sub }}>{stake > 0 ? (c * stake).toLocaleString('vi-VN') : '+' + c}</span>
                  </button>
                )
              })}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: wide ? 'none' : '1 1 100%' }}>
            {canBet && (
              <>
                <button type="button" disabled={!puts.length} onClick={() => setDraft({ round: state.round, puts: puts.slice(0, -1) })} aria-label={t('games.baucua.undo')} title={t('games.baucua.undo')} style={{ ...btn('ghost'), padding: '12px 14px', opacity: puts.length ? 1 : 0.45 }}>
                  <Icon name="undo-2" size={15} />{wide && t('games.baucua.undo')}
                </button>
                <button type="button" disabled={!puts.length} onClick={() => setDraft({ round: state.round, puts: [] })} aria-label={t('games.baucua.clear')} title={t('games.baucua.clear')} style={{ ...btn('ghost'), padding: '12px 14px', opacity: puts.length ? 1 : 0.45 }}>
                  <Icon name="x" size={15} />{wide && t('games.baucua.clear')}
                </button>
              </>
            )}
            <button type="button" disabled={!act} onClick={act || undefined} style={{
              ...btn('primary'), flex: 1, minWidth: wide ? 200 : 0, padding: '14px 22px', font: '800 16px/1 var(--font-sans)', whiteSpace: 'nowrap',
              ...(act ? { background: 'linear-gradient(180deg,#c23a28,#96221a)', color: '#fff3d6', border: '1.5px solid ' + BC.gold, boxShadow: '0 5px 0 #5c120c, 0 12px 24px -6px rgba(0,0,0,.45)' }
                : { background: G.inset, color: G.muted, border: '1.5px solid ' + G.line, cursor: 'default' }),
            }}>{actLabel}</button>
          </div>
        </div>
      )}

      {actions?.length > 0 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {actions.map((x) => (
            <button key={x.key} type="button" disabled={x.off} onClick={x.on} style={{ ...btn(x.danger ? 'danger' : 'ghost', { sm: true }), opacity: x.off ? 0.45 : 1 }}>
              <Icon name={x.icon} size={14} />{x.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
