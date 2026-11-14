import { useMemo, useState } from 'react'
import { Button } from '#ds'
import { useMobile } from '#hooks/useMobile.js'
import { t } from '#i18n'
import cv, { areaOf, around, capOf, groupOf, KOMI, place } from '#lib/games/covay.js'
import { overOf, rnd } from '#components/games/chessUi.js'
import ChessStage from '#components/games/ChessStage.jsx'
import CutScene, { useCloseUp } from '#components/games/CutScene.jsx'
import { SKY } from '#components/games/characters.js'

// Bàn Cờ vây · Vây sao (bản "Cờ · sinh động", 2026-11-14): bầu trời đêm có tinh vân, lưới phát sáng; Đen (ghế 0) là hành
// tinh có vành, Trắng (ghế 1) là ngôi sao. Khung, thanh người chơi, cán cân (ước điểm vùng), màn kết thúc: ChessStage —
// bàn 588 cỡ thiết kế cho cả 9 / 13 / 19 (cỡ quân theo khoảng cách đường kẻ), co cho vừa màn hình.
// Máy tính: rê chuột xem trước quân + các khí của nó, bấm là đặt. Điện thoại: chạm để ngắm (quân mờ + chữ thập), chạm lại
// đúng điểm đó hoặc bấm "Đặt quân" — bàn 19 × 19 trên màn nhỏ mỗi ô chỉ ~16px, một chạm dễ lệch. Bấm điểm cấm (ko, tự
// sát) thì báo lý do. Hiệu ứng suy từ state.last (key theo số nước): quân rơi xuống · nhóm còn một khí nháy đỏ · quân bị
// ăn bay vút khỏi bàn + chữ Hút / Thu · ăn từ 2 quân và bật Cận cảnh thì có cảnh hố đen (Đen) / siêu tân tinh (Trắng).
// Hết ván: tô đất từng bên + bảng điểm. Luật: lib/games/covay.js · server chấm: 0089. Màu viết cứng (DESIGN.md §2.4).

const FIELD = 588
const BOX = { w: FIELD, h: FIELD, pad: 20, radius: 20 }
const SK = { frame: 'linear-gradient(160deg,#1a2350,#0a0f26)', border: 'rgba(140,210,255,.35)', acc: '#7fd8ff', rgb: '127,216,255', page: 'rgba(120,100,255,.2)', gem: false }
const PAD = { 9: 46, 13: 36, 19: 26 } // lề quanh lưới theo cỡ bàn
const STARS = {
  9: [[2, 2], [2, 6], [6, 2], [6, 6], [4, 4]],
  13: [[3, 3], [3, 9], [9, 3], [9, 9], [6, 6]],
  19: [3, 9, 15].flatMap((r) => [3, 9, 15].map((c) => [r, c])),
}
// Theo ghế: màu nhấn · nền ô đại diện · màu đất lúc đếm · cận cảnh.
const SIDE = [
  { col: '#b49cff', av: 'radial-gradient(circle at 35% 30%,#a99bff,#5a3fb0 40%,#1a1238 75%)', land: 'rgba(180,156,255,.42)', tag: '#5a3fb0',
    cut: { bg: 'radial-gradient(120% 140% at 50% 50%,rgba(40,20,90,.97),rgba(6,6,24,.98))', dot: 'radial-gradient(circle,#fffbe6,#ffd76a 55%,#c99a2e)' } },
  { col: '#ffe08a', av: 'radial-gradient(circle,#fffbe6,#ffd76a 50%,#c99a2e)', land: 'rgba(255,224,138,.42)', tag: '#c99a2e',
    cut: { bg: 'radial-gradient(120% 140% at 50% 50%,rgba(90,60,10,.97),rgba(20,10,4,.98))', core: 'radial-gradient(circle,#fff 0 20%,#ffe08a 38%,rgba(255,160,40,.7) 52%,transparent 70%)', dot: 'radial-gradient(circle at 34% 30%,#a99bff,#5a3fb0 45%,#1e1446)' } },
]
const komiText = KOMI.toLocaleString('vi-VN')
const vi = (x) => x.toLocaleString('vi-VN')

/** Một quân cỡ `s` px: hành tinh có vành (Đen) hoặc ngôi sao toả sáng (Trắng). `atari` = nhóm còn một khí. */
function Stone({ seat, s, x, y, fresh, atari, ghost }) {
  const k = s / 50
  const pos = { position: 'absolute', left: x, top: y, width: s, height: s, borderRadius: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', opacity: ghost ? 0.5 : 1, animation: fresh ? 'cvDrop .45s cubic-bezier(.2,1.3,.4,1)' : undefined }
  const warn = atari && <span style={{ position: 'absolute', inset: -2, borderRadius: '50%', animation: 'cvAtari 1s ease-in-out infinite' }} />
  if (seat === 0) {
    return (
      <span style={{ ...pos, background: 'radial-gradient(circle at 34% 30%,#a99bff 0,#5a3fb0 28%,#1e1446 62%,#08061a 100%)', boxShadow: `inset ${-6 * k}px ${-8 * k}px ${12 * k}px rgba(0,0,0,.6), 0 0 ${14 * k}px rgba(150,120,255,.55)` }}>
        <span style={{ position: 'absolute', left: -7 * k, right: -7 * k, top: '44%', height: 9 * k, borderRadius: '50%', border: `${Math.max(1, 2 * k)}px solid rgba(200,180,255,.7)`, transform: 'rotate(-18deg)' }} />
        {warn}
      </span>
    )
  }
  const flare = (h) => ({ position: 'absolute', background: `linear-gradient(${h ? 90 : 180}deg,transparent,rgba(255,255,255,.9),transparent)`, ...(h ? { top: '50%', left: -10 * k, right: -10 * k, height: 3 * k, marginTop: -1.5 * k } : { left: '50%', top: -10 * k, bottom: -10 * k, width: 3 * k, marginLeft: -1.5 * k }) })
  return (
    <span style={{ ...pos, background: 'radial-gradient(circle,#ffffff 0,#fff6d0 30%,#ffd76a 62%,#c99a2e 100%)', boxShadow: `0 0 ${18 * k}px rgba(255,220,120,.9), 0 0 ${40 * k}px rgba(255,220,120,.4)` }}>
      <span style={flare(false)} /><span style={flare(true)} />
      {warn}
    </span>
  )
}

/** Các khí của nhóm sẽ có nếu `seat` đặt ở i (để vẽ chấm xem trước) — [] nếu nước sai. */
function libsAfter(board, n, i, seat) {
  const p = place(board, n, i, seat)
  if (!p) return []
  const libs = new Set()
  for (const x of groupOf(p.board, n, i).stones) for (const y of around(n, x)) if (p.board[y] == null) libs.add(y)
  return [...libs]
}

export default function CoVayBoard({ state, mySeat, canMove, onMove, result, names, note, actions, overActions, bubbles }) {
  const isMobile = useMobile(768)
  const closeUp = useCloseUp()
  const { size: n, board, last, ko, over, ply } = state
  const pad = PAD[n] || 30
  const gap = (FIELD - pad * 2) / (n - 1)
  const SZ = Math.min(50, gap * 0.8) // cỡ quân
  const xy = (i) => [pad + (i % n) * gap, pad + Math.floor(i / n) * gap]
  const [hover, setHover] = useState(null)
  // Ngắm / lỗi gắn với số nước: sang nước mới thì tự bỏ, khỏi xoá trong effect.
  const [aim, setAim] = useState(null) // { i, ply }
  const [why, setWhy] = useState(null) // { i, ply, key }
  const aimAt = canMove && aim?.ply === ply ? aim.i : null
  const err = why?.ply === ply ? why.key : null
  const est = useMemo(() => areaOf(board, n), [board, n]) // vùng ước tính lúc đang chơi, hết ván là vùng chốt
  // Nhóm còn đúng một khí — nháy đỏ.
  const atari = useMemo(() => {
    const out = new Set()
    for (let i = 0; i < board.length; i++) if (board[i] != null && !out.has(i)) { const g = groupOf(board, n, i); if (g.libs === 1) g.stones.forEach((x) => out.add(x)) }
    return out
  }, [board, n])
  const stones = [0, 1].map((p) => board.filter((v) => v === p).length)
  const bottom = mySeat === 1 ? 1 : 0
  const top = 1 - bottom
  const side = (p) => t('games.covay.side' + p)
  const live = !over && !result

  /** Giao điểm gần chỗ bấm nhất (toạ độ màn hình → toạ độ bàn), ngoài bàn thì null. */
  const pointAt = (e) => {
    const box = e.currentTarget.getBoundingClientRect()
    const c = Math.round(((e.clientX - box.left) * (FIELD / box.width) - pad) / gap)
    const r = Math.round(((e.clientY - box.top) * (FIELD / box.height) - pad) / gap)
    return r < 0 || c < 0 || r >= n || c >= n ? null : r * n + c
  }
  const put = (i) => { setAim(null); setHover(null); setWhy(null); onMove({ i }) }
  const tap = (e) => {
    if (!canMove) return
    const i = pointAt(e)
    if (i == null || board[i] != null) return
    const bad = cv.validate(state, mySeat, { i })
    if (bad) { setWhy({ i, ply, key: bad }); setAim(null); return }
    setWhy(null)
    if (e.pointerType !== 'mouse' && aimAt !== i) { setAim({ i, ply }); return }
    put(i)
  }
  const glide = (e) => {
    if (!canMove || e.pointerType !== 'mouse') return
    const i = pointAt(e)
    setHover(i != null && board[i] == null ? i : null)
  }
  const ghost = aimAt ?? (hover != null && cv.validate(state, mySeat, { i: hover }) == null ? hover : null)
  const libs = ghost != null && mySeat != null ? libsAfter(board, n, ghost, mySeat) : []
  const oppPassed = live && last?.pass && last.seat !== mySeat && mySeat != null

  const bar = (seat) => {
    const turn = live && state.turn === seat
    const mine = seat === mySeat
    const sz = isMobile ? 38 : 46
    const area = seat ? est.w + KOMI : est.b
    return {
      me: mine,
      name: names?.[seat] || side(seat),
      tag: '· ' + side(seat),
      mark: (
        <span style={{ width: sz, height: sz, borderRadius: '50%', background: SIDE[seat].av, boxShadow: '0 0 0 2px ' + SIDE[seat].col, display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
          <img src={SKY[seat]} alt="" style={{ width: sz * 0.85, height: sz * 1.03, marginTop: sz * 0.18 }} />
        </span>
      ),
      caps: <span style={{ font: '400 12px/1.3 var(--font-mono)', color: 'var(--text-muted)' }}>{t('games.covay.barLine', { caps: state.caps[seat], area: vi(area) })}</span>,
      status: turn && mine ? t('games.yourTurn') : note?.[seat] || (turn ? t('games.covay.thinking') : ''),
      bubble: bubbles?.[seat],
      glow: SIDE[seat].col,
    }
  }
  const sum = est.b + est.w + KOMI
  const evalPct = ((bottom ? est.w + KOMI : est.b) / sum) * 100
  const endState = { ...state, reason: ply >= capOf(n) ? 'cap' : 'pass', winner: state.score ? (state.score[0] > state.score[1] ? 0 : 1) : null }
  const ended = overOf({ state: endState, result, mySeat, names: names || { 0: side(0), 1: side(1) }, reasons: 'games.covay.end.' })

  // Hiệu ứng của nước vừa đi (key theo số nước → mỗi nước diễn một lần).
  const fx = []
  const k = 'p' + ply
  if (last && !last.pass) {
    const [x, y] = xy(last.i)
    const col = SIDE[last.seat].col
    fx.push(<span key={k + 'land'} style={{ position: 'absolute', left: x, top: y, width: SZ * 1.4, height: SZ * 1.4, borderRadius: '50%', border: '3px solid ' + col, boxShadow: '0 0 14px ' + col, opacity: 0, animation: 'chRipple .6s ease-out .1s forwards' }} />)
    const caps = last.captured || []
    caps.slice(0, 24).forEach((c, j) => {
      const [cx, cy] = xy(c)
      const dir = last.seat === 0 ? 1 : -1
      fx.push(<span key={k + 's' + c} style={{
        position: 'absolute', left: cx, top: cy, width: 16, height: 16, margin: '-8px 0 0 -8px', borderRadius: '50%', zIndex: 6,
        background: `radial-gradient(circle at 35% 35%,#fff,${SIDE[1 - last.seat].col} 60%)`, boxShadow: '0 0 12px ' + SIDE[1 - last.seat].col,
        offsetPath: `path('M0 0 Q${120 * dir} -60 ${260 * dir} -${Math.round(cy + 60)}')`, offsetRotate: '0deg', opacity: 0,
        animation: `cvShot .9s cubic-bezier(.4,0,.7,1) ${0.15 + j * 0.07}s forwards`,
      }} />)
    })
    if (caps.length) {
      for (let j = 0; j < 10; j++) {
        const a = (j / 10) * Math.PI * 2
        const d = 40 + rnd(j * 2.3 + ply) * 30
        const c = ['#ffffff', '#ffe08a', '#b49cff'][j % 3]
        fx.push(<span key={k + 'b' + j} style={{ position: 'absolute', left: x, top: y, width: 11, height: 11, background: c, boxShadow: '0 0 6px ' + c, clipPath: 'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)', '--dx': Math.cos(a) * d + 'px', '--dy': Math.sin(a) * d + 'px', opacity: 0, animation: 'chBurst .8s cubic-bezier(.2,.7,.3,1) .15s forwards' }} />)
      }
      fx.push(<span key={k + 'txt'} style={{ position: 'absolute', left: x, top: y - 36, padding: '5px 12px', borderRadius: 99, background: SIDE[last.seat].tag, color: '#fff', whiteSpace: 'nowrap', font: '800 18px/1.1 var(--font-display)', boxShadow: '0 8px 20px rgba(0,0,0,.45)', opacity: 0, animation: 'chBanner 1.5s ease-out .15s forwards', zIndex: 8 }}>
        {t(last.seat ? 'games.covay.fx.take1' : 'games.covay.fx.take0', { n: caps.length })}
      </span>)
    }
  }
  if (last?.pass) {
    fx.push(<span key={k + 'pass'} style={{ position: 'absolute', left: '50%', top: '50%', padding: '6px 14px', borderRadius: 99, background: '#3a4566', color: '#fff', whiteSpace: 'nowrap', font: '800 20px/1.1 var(--font-display)', boxShadow: '0 8px 20px rgba(0,0,0,.45)', opacity: 0, animation: 'chBanner 1.5s ease-out forwards', zIndex: 8 }}>
      {t('games.covay.fx.pass', { side: side(last.seat) })}
    </span>)
  }
  const nCap = last?.captured?.length || 0
  const cut = closeUp && nCap >= 2 && (
    <CutScene key={'cut' + ply} kind="hole" n={nCap} col={SIDE[last.seat].col} delay={0.3} {...SIDE[last.seat].cut}
      title={t(last.seat ? 'games.covay.cut.title1' : 'games.covay.cut.title0', { n: nCap })} sub={t(last.seat ? 'games.covay.cut.sub1' : 'games.covay.cut.sub0')} />
  )

  return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <ChessStage sk={SK} box={BOX} top={bar(top)} bottom={bar(bottom)} turnTop={live && state.turn === top} turnBottom={live && state.turn === bottom}
        evalPct={evalPct} over={ended} overActions={overActions} actions={actions}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: BOX.radius, overflow: 'hidden',
          background: 'radial-gradient(40% 35% at 75% 20%,rgba(150,90,220,.35),transparent 70%),radial-gradient(35% 40% at 15% 80%,rgba(30,160,170,.28),transparent 70%),radial-gradient(circle,rgba(255,255,255,.85) 0 1px,transparent 1.6px) 0 0/53px 47px,radial-gradient(circle,rgba(200,220,255,.6) 0 .8px,transparent 1.3px) 20px 31px/71px 67px,#070b1e',
        }}>
          <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle,#fff 0 1.2px,transparent 2px) 13px 9px/151px 137px', animation: 'skyTwinkle 3.4s ease-in-out infinite' }} />
          {/* Lưới: quầng sáng rộng + nét mảnh; điểm sao là chấm có tia */}
          <svg aria-hidden="true" width={FIELD} height={FIELD} style={{ position: 'absolute', inset: 0 }}>
            {[['rgba(140,210,255,.12)', 6], ['rgba(140,210,255,.38)', 1.4]].map(([c, w]) => (
              <g key={w} stroke={c} strokeWidth={w}>
                {Array.from({ length: n }, (_, j) => {
                  const p = pad + j * gap
                  return [<line key={'v' + j} x1={p} y1={pad} x2={p} y2={FIELD - pad} />, <line key={'h' + j} x1={pad} y1={p} x2={FIELD - pad} y2={p} />]
                })}
              </g>
            ))}
            {STARS[n].map(([r, c]) => (
              <g key={r + '-' + c} transform={`translate(${pad + c * gap} ${pad + r * gap}) scale(${Math.min(1, gap / 62)})`}>
                <circle r={5} fill="#bfe8ff" />
                <path d="M0 -11 L1.4 -1.4 L11 0 L1.4 1.4 L0 11 L-1.4 1.4 L-11 0 L-1.4 -1.4 Z" fill="#bfe8ff" opacity={0.7} />
              </g>
            ))}
          </svg>

          {/* Hết ván: đất của từng bên */}
          {over && est.owner.map((who, i) => {
            if (board[i] != null || who == null) return null
            const [x, y] = xy(i)
            return <span key={'a' + i} style={{ position: 'absolute', left: x - gap * 0.4, top: y - gap * 0.4, width: gap * 0.8, height: gap * 0.8, borderRadius: Math.max(3, gap * 0.13), background: SIDE[who].land }} />
          })}

          {board.map((v, i) => {
            if (v == null) return null
            const [x, y] = xy(i)
            return <Stone key={i + '-' + v} seat={v} s={SZ} x={x} y={y} fresh={last?.i === i} atari={live && atari.has(i)} />
          })}
          {last?.i != null && board[last.i] != null && (() => {
            const [x, y] = xy(last.i)
            return <span aria-hidden="true" style={{ position: 'absolute', left: x, top: y, width: 12, height: 12, margin: '-6px 0 0 -6px', borderRadius: '50%', border: '2px solid #7fffd4', boxShadow: '0 0 8px #7fffd4', pointerEvents: 'none' }} />
          })()}

          {/* Điểm ko: ô vuông viền — nhắc người tới lượt chưa được ăn lại ở đây */}
          {live && ko >= 0 && canMove && (() => {
            const [x, y] = xy(ko)
            return <span aria-hidden="true" style={{ position: 'absolute', left: x - 9, top: y - 9, width: 18, height: 18, border: '2.4px solid #ff5a50', pointerEvents: 'none' }} />
          })()}

          {/* Quân xem trước (rê chuột) / đang ngắm (chạm) + các khí của nó */}
          {ghost != null && mySeat != null && (() => {
            const [x, y] = xy(ghost)
            return (
              <>
                {aimAt != null && (
                  <>
                    <span style={{ position: 'absolute', left: pad, right: pad, top: y - 1, height: 2, background: '#7fd8ff', opacity: 0.8, pointerEvents: 'none' }} />
                    <span style={{ position: 'absolute', top: pad, bottom: pad, left: x - 1, width: 2, background: '#7fd8ff', opacity: 0.8, pointerEvents: 'none' }} />
                  </>
                )}
                <Stone seat={mySeat} s={SZ} x={x} y={y} ghost />
                {libs.map((l) => {
                  const [lx, ly] = xy(l)
                  return <span key={'l' + l} style={{ position: 'absolute', left: lx, top: ly, width: 14, height: 14, borderRadius: '50%', background: '#7fd8ff', boxShadow: '0 0 10px #7fd8ff', transform: 'translate(-50%, -50%)', pointerEvents: 'none', animation: 'chAura 1s ease-in-out infinite' }} />
                })}
              </>
            )
          })()}

          {/* Lớp bấm: một mặt phẳng phủ cả bàn, tự tìm giao điểm gần nhất */}
          <div role="img" aria-label={t('games.covay.boardAria', { n })} onPointerUp={tap} onPointerMove={glide} onPointerLeave={() => setHover(null)}
            style={{ position: 'absolute', inset: 0, zIndex: 5, cursor: canMove ? 'pointer' : 'default' }} />
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 8 }}>{fx}</div>
          {cut}
        </div>
      </ChessStage>

      {oppPassed && <div style={S.notice} aria-live="polite">{t('games.covay.passed', { side: side(last.seat) })}</div>}

      {canMove && (
        <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
          <span style={{ ...S.hint, color: err ? 'var(--status-incident-fg)' : S.hint.color }} aria-live="polite">
            {err ? t(err) : t(isMobile ? 'games.covay.aimHint' : 'games.covay.pickHint')}
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {aimAt != null && <Button icon="check" onClick={() => put(aimAt)}>{t('games.covay.put')}</Button>}
            <Button variant="secondary" icon="skip-forward" onClick={() => { setAim(null); onMove({ pass: true }) }}>
              {t(oppPassed ? 'games.covay.passEnd' : 'games.covay.pass')}
            </Button>
          </div>
        </div>
      )}

      {over && state.score && (
        <div style={S.score}>
          {[0, 1].map((p) => (
            <span key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 99, flexShrink: 0, background: SIDE[p].av, boxShadow: '0 0 0 1px ' + SIDE[p].col }} />
              <span style={{ minWidth: 0 }}>
                {t(p ? 'games.covay.scoreLine1' : 'games.covay.scoreLine0', {
                  side: side(p), stones: stones[p], land: (p ? est.w : est.b) - stones[p], komi: komiText, total: vi(state.score[p]),
                })}
              </span>
            </span>
          ))}
          <span style={S.hint}>{t('games.covay.scoreNote')}</span>
        </div>
      )}
    </div>
  )
}

const S = {
  hint: { font: 'var(--type-caption)', color: 'var(--text-muted)', textAlign: 'center' },
  notice: {
    justifySelf: 'center', padding: '6px 12px', borderRadius: 99, textAlign: 'center',
    background: 'var(--status-delayed-bg)', color: 'var(--status-delayed-fg)', font: 'var(--type-caption)',
  },
  score: {
    display: 'grid', gap: 8, gridTemplateColumns: 'minmax(0, 1fr)', padding: '12px 14px', borderRadius: 10,
    background: 'var(--surface-inset)', font: 'var(--type-body)', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums',
  },
}
